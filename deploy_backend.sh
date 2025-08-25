#!/bin/bash

set -euo pipefail

GITHUB_REPO="Gouryella/UFW-Panel"
GITHUB_API="https://api.github.com/repos/$GITHUB_REPO/releases/latest"

INSTALL_DIR="/usr/local/bin/ufw-panel-backend"
EXECUTABLE_NAME="ufw-panel-backend"
EXECUTABLE_PATH="$INSTALL_DIR/$EXECUTABLE_NAME"
ENV_FILE="$INSTALL_DIR/.env_ufw_backend"
SERVICE_NAME="ufw-panel-backend"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

red='\033[0;31m'
orange='\033[38;5;214m'
green='\033[0;32m'
yellow='\033[0;33m'
plain='\033[0m'

log_info()       { echo -e "${orange}[INFO]${green} $1${plain}"; }
log_warn()       { echo -e "${yellow}[WARN]${plain} $1"; }
log_error_exit() { echo -e "${red}[ERROR]${plain} $1" >&2; exit 1; }

check_root() {
  [[ $(id -u) -eq 0 ]] || log_error_exit "此脚本需要以 root 权限运行：sudo ./deploy_backend.sh"
}

detect_arch() {
  case "$(uname -m)" in
    x86_64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) log_error_exit "不支持的架构: $(uname -m)" ;;
  esac
  log_info "检测到架构: $ARCH"
}

ensure_ufw_installed() {
  if ! command -v ufw >/dev/null 2>&1; then
    log_info "未检测到 UFW，正在安装..."
    if command -v apt-get >/dev/null 2>&1; then
      apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y ufw
    elif command -v dnf >/dev/null 2>&1; then
      dnf install -y ufw
    elif command -v yum >/dev/null 2>&1; then
      yum install -y ufw
    else
      log_error_exit "无法自动安装 UFW，请手动安装后重试。"
    fi
  else
    log_info "已检测到 UFW。"
  fi
  systemctl enable --now ufw
  systemctl is-active --quiet ufw || log_error_exit "UFW 启动失败：journalctl -u ufw"
  log_info "UFW 已启动并设为开机自启。"
}

update_ufw_after_rules() {
  local f="/etc/ufw/after.rules"
  [[ -f $f ]] && cp "$f" "${f}.bak.$(date +%s)" && log_info "已备份原 after.rules"
  cat > "$f" <<'EOF'
*filter
:ufw-user-forward - [0:0]
:ufw-docker-logging-deny - [0:0]
:DOCKER-USER - [0:0]
-A DOCKER-USER -j ufw-user-forward
-A DOCKER-USER -m iprange --src-range 172.16.0.0-172.37.255.255 -j RETURN
-A DOCKER-USER -j ufw-docker-logging-deny
-A ufw-docker-logging-deny -m limit --limit 3/min --limit-burst 10 -j LOG --log-prefix "[UFW DOCKER BLOCK] "
-A ufw-docker-logging-deny -j DROP
COMMIT
EOF
  ufw reload && log_info "/etc/ufw/after.rules 已更新并加载。"
}

fetch_latest_backend_url() {
  log_info "从 GitHub 获取最新版本信息..."
  BACKEND_URL=$(curl -fsSL "$GITHUB_API" | grep '"browser_download_url"' | grep "$ARCH" | grep "$EXECUTABLE_NAME" | cut -d '"' -f 4 || true)
  [[ -n ${BACKEND_URL:-} ]] || log_error_exit "未找到架构 $ARCH 的可用版本。"
  log_info "下载链接: $BACKEND_URL"
}

trim_commas() {
  local s="$1"
  s="${s//，/,}"                # 中文逗号=>英文
  s="$(echo "$s" | sed 's/ \{1,\}//g')"  # 去除所有空格
  echo "$s"
}

prompt_port() {
  local d=30737
  read -p "$(echo -e "${yellow}请输入后端服务监听端口 (默认 $d): ${plain}")" p
  PORT=${p:-$d}
  [[ $PORT =~ ^[0-9]+$ && $PORT -ge 1 && $PORT -le 65535 ]] || log_error_exit "无效端口: $PORT"
  log_info "监听端口: $PORT"
}

prompt_password() {
  while true; do
    read -s -p "$(echo -e "${yellow}请输入用于访问后端 API 的密码(UFW_API_KEY): ${plain}")" pwd; echo
    [[ -n $pwd ]] || { echo -e "${red}[ERROR]${plain} 密码不能为空。"; continue; }
    read -s -p "$(echo -e "${yellow}请再次输入密码确认: ${plain}")" pwd2; echo
    [[ $pwd == $pwd2 ]] || { echo -e "${red}[ERROR]${plain} 两次输入不一致。"; continue; }
    PASSWORD=$pwd
    break
  done
  log_info "API 密码已设置。"
}

prompt_cors_origins() {
  read -p "$(echo -e "${yellow}请输入允许跨域的来源(可多项, 逗号分隔)：${plain}")" cors
  cors="${cors:-http://localhost:3000}"
  CORS_ALLOWED_ORIGINS="$(trim_commas "$cors")"
  log_info "CORS 允许来源: $CORS_ALLOWED_ORIGINS"
}

prompt_max_fails() {
  local d=5
  read -p "$(echo -e "${yellow}请输入同一 IP 最大失败次数阈值 MAX_FAILS (默认 $d)：${plain}")" mf
  mf=${mf:-$d}
  [[ $mf =~ ^[0-9]+$ && $mf -ge 1 && $mf -le 50 ]] || log_error_exit "无效 MAX_FAILS: $mf"
  MAX_FAILS="$mf"
  log_info "MAX_FAILS: $MAX_FAILS"
}

prompt_timeout() {
  local d=5
  read -p "$(echo -e "${yellow}请输入 UFW 命令超时时间(秒) UFW_TIMEOUT_SEC (默认 $d)：${plain}")" ts
  ts=${ts:-$d}
  [[ $ts =~ ^[0-9]+$ && $ts -ge 1 && $ts -le 60 ]] || log_error_exit "无效 UFW_TIMEOUT_SEC: $ts"
  UFW_TIMEOUT_SEC="$ts"
  log_info "UFW_TIMEOUT_SEC: $UFW_TIMEOUT_SEC"
}

prompt_use_sudo() {
  local default_choice="n"
  read -p "$(echo -e "${yellow}服务是否以非 root 用户运行、需要在后端中使用 sudo 执行 ufw？(y/N，默认 $default_choice)：${plain}")" yn
  case "${yn:-$default_choice}" in
    y|Y) UFW_SUDO=1; log_info "UFW_SUDO=1" ;;
    *)   UFW_SUDO=0; log_info "UFW_SUDO=0 (以 root 运行或不需要 sudo)" ;;
  esac
}

prompt_tls_paths() {
  read -p "$(echo -e "${yellow}如需自定义 TLS 证书路径，请输入证书文件路径(留空跳过, 后端将自签)：${plain}")" TLS_CERT_PATH
  read -p "$(echo -e "${yellow}如需自定义 TLS 私钥路径，请输入私钥文件路径(留空跳过)：${plain}")" TLS_KEY_PATH
  if [[ -n "${TLS_CERT_PATH}" && -z "${TLS_KEY_PATH}" ]]; then
    log_warn "仅提供了证书路径，未提供私钥路径，将忽略自定义证书并使用自签。"
    TLS_CERT_PATH=""
  fi
  if [[ -n "${TLS_KEY_PATH}" && -z "${TLS_CERT_PATH}" ]]; then
    log_warn "仅提供了私钥路径，未提供证书路径，将忽略自定义证书并使用自签。"
    TLS_KEY_PATH=""
  fi
  if [[ -n "${TLS_CERT_PATH}" && -n "${TLS_KEY_PATH}" ]]; then
    [[ -f "$TLS_CERT_PATH" ]] || log_error_exit "证书文件不存在: $TLS_CERT_PATH"
    [[ -f "$TLS_KEY_PATH"  ]] || log_error_exit "私钥文件不存在: $TLS_KEY_PATH"
    log_info "将使用自定义证书：$TLS_CERT_PATH / $TLS_KEY_PATH"
  else
    log_info "未提供自定义证书，将由后端自动生成自签证书。"
  fi
}

download_backend() {
  log_info "下载后端可执行文件..."
  mkdir -p "$INSTALL_DIR"
  curl -fL --progress-bar "$BACKEND_URL" -o "$EXECUTABLE_PATH" || log_error_exit "下载失败，请检查网络。"
  chmod +x "$EXECUTABLE_PATH"
  log_info "下载完成并已赋予执行权限。"
}

create_env_file() {
  cat > "$ENV_FILE" <<EOF
PORT=$PORT
UFW_API_KEY=$PASSWORD
CORS_ALLOWED_ORIGINS=$CORS_ALLOWED_ORIGINS
MAX_FAILS=$MAX_FAILS
UFW_TIMEOUT_SEC=$UFW_TIMEOUT_SEC
UFW_SUDO=$UFW_SUDO
EOF
  if [[ -n "${TLS_CERT_PATH:-}" && -n "${TLS_KEY_PATH:-}" ]]; then
    cat >> "$ENV_FILE" <<EOF
TLS_CERT_PATH=$TLS_CERT_PATH
TLS_KEY_PATH=$TLS_KEY_PATH
EOF
  fi
  chmod 600 "$ENV_FILE"
  log_info "已生成环境文件：$ENV_FILE"
}

create_systemd_service() {
  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=UFW Panel Backend Service
After=network.target

[Service]
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$EXECUTABLE_PATH
Restart=on-failure
RestartSec=3
# 可按需指定非 root 用户运行（若配置，且需要 UFW_SUDO=1，需相应 sudoers 放行）
# User=ufwpanel
# Group=ufwpanel

[Install]
WantedBy=multi-user.target
EOF
  log_info "已生成 systemd 服务文件：$SERVICE_FILE"
}

allow_api_port() {
  if command -v ufw >/dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
      ufw allow "${PORT}/tcp" || true
      log_info "已通过 UFW 放行 ${PORT}/tcp"
    else
      log_warn "UFW 当前未激活，跳过预放行 ${PORT}/tcp（后端启动后也会自放行）。"
    fi
  fi
}

enable_and_start_service() {
  systemctl daemon-reload
  systemctl enable --now "$SERVICE_NAME"
  sleep 2
  systemctl is-active --quiet "$SERVICE_NAME" && log_info "服务 $SERVICE_NAME 启动成功。" || log_error_exit "服务启动失败：journalctl -u $SERVICE_NAME -e --no-pager"
}

upgrade_flow() {
  fetch_latest_backend_url
  systemctl stop "$SERVICE_NAME"
  download_backend
  systemctl start "$SERVICE_NAME"
  sleep 2
  systemctl is-active --quiet "$SERVICE_NAME" && log_info "升级完成并已重新启动服务。" || log_error_exit "服务重启失败：journalctl -u $SERVICE_NAME -e --no-pager"
}

install_flow() {
  ensure_ufw_installed
  update_ufw_after_rules
  fetch_latest_backend_url
  prompt_port
  prompt_password
  prompt_cors_origins
  prompt_max_fails
  prompt_timeout
  prompt_use_sudo
  prompt_tls_paths
  download_backend
  create_env_file
  create_systemd_service
  allow_api_port
  enable_and_start_service

  echo
  log_info "✅ 部署完成"
  log_info "服务名称: $SERVICE_NAME"
  log_info "监听端口: $PORT"
  log_info "执行路径: $EXECUTABLE_PATH"
  log_info "环境文件: $ENV_FILE"
  log_info "systemd 文件: $SERVICE_FILE"
  echo
  log_info "常用命令："
  log_info "  查看状态: systemctl status $SERVICE_NAME"
  log_info "  停止服务: systemctl stop $SERVICE_NAME"
  log_info "  启动服务: systemctl start $SERVICE_NAME"
  log_info "  重启服务: systemctl restart $SERVICE_NAME"
  log_info "  查看日志: journalctl -u $SERVICE_NAME -f"
}

main() {
  check_root
  detect_arch
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    upgrade_flow
  else
    install_flow
  fi
}

main

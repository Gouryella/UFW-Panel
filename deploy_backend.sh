#!/bin/bash
#
# UFW Panel Backend Deployment Script
# Supports both English and Chinese languages
# 
# Usage:
#   ./deploy_backend.sh       # English (default)
#   ./deploy_backend.sh en    # English
#   ./deploy_backend.sh zh    # Chinese
#   ./deploy_backend.sh -h    # Show help
#

set -euo pipefail

# Default language mode (will be set by main function)
LANG_MODE="en"

# Multilingual text function
get_text() {
  case "$1" in
    "root_required")
      case "$LANG_MODE" in
        "zh") echo "此脚本需要以 root 权限运行：sudo ./deploy_backend.sh" ;;
        *) echo "This script requires root privileges: sudo ./deploy_backend.sh" ;;
      esac ;;
    "arch_unsupported")
      case "$LANG_MODE" in
        "zh") echo "不支持的架构: $(uname -m)" ;;
        *) echo "Unsupported architecture: $(uname -m)" ;;
      esac ;;
    "arch_detected")
      case "$LANG_MODE" in
        "zh") echo "检测到架构: $ARCH" ;;
        *) echo "Detected architecture: $ARCH" ;;
      esac ;;
    "ufw_not_detected")
      case "$LANG_MODE" in
        "zh") echo "未检测到 UFW，正在安装..." ;;
        *) echo "UFW not detected, installing..." ;;
      esac ;;
    "ufw_auto_install_failed")
      case "$LANG_MODE" in
        "zh") echo "无法自动安装 UFW，请手动安装后重试。" ;;
        *) echo "Unable to automatically install UFW, please install manually and retry." ;;
      esac ;;
    "ufw_detected")
      case "$LANG_MODE" in
        "zh") echo "已检测到 UFW。" ;;
        *) echo "UFW detected." ;;
      esac ;;
    "ufw_start_failed")
      case "$LANG_MODE" in
        "zh") echo "UFW 启动失败：journalctl -u ufw" ;;
        *) echo "UFW failed to start: journalctl -u ufw" ;;
      esac ;;
    "ufw_enabled")
      case "$LANG_MODE" in
        "zh") echo "UFW 已启动并设为开机自启。" ;;
        *) echo "UFW has been started and enabled for auto-start." ;;
      esac ;;
    "after_rules_backup")
      case "$LANG_MODE" in
        "zh") echo "已备份原 after.rules" ;;
        *) echo "Original after.rules backed up" ;;
      esac ;;
    "after_rules_updated")
      case "$LANG_MODE" in
        "zh") echo "/etc/ufw/after.rules 已更新并加载。" ;;
        *) echo "/etc/ufw/after.rules updated and loaded." ;;
      esac ;;
    "fetching_latest")
      case "$LANG_MODE" in
        "zh") echo "从 GitHub 获取最新版本信息..." ;;
        *) echo "Fetching latest version information from GitHub..." ;;
      esac ;;
    "version_not_found")
      case "$LANG_MODE" in
        "zh") echo "未找到架构 $ARCH 的可用版本。" ;;
        *) echo "No available version found for architecture $ARCH." ;;
      esac ;;
    "download_url")
      case "$LANG_MODE" in
        "zh") echo "下载链接: $BACKEND_URL" ;;
        *) echo "Download URL: $BACKEND_URL" ;;
      esac ;;
    "prompt_port")
      case "$LANG_MODE" in
        "zh") echo "请输入后端服务监听端口 (默认 $2): " ;;
        *) echo "Please enter backend service listening port (default $2): " ;;
      esac ;;
    "invalid_port")
      case "$LANG_MODE" in
        "zh") echo "无效端口: $PORT" ;;
        *) echo "Invalid port: $PORT" ;;
      esac ;;
    "listening_port")
      case "$LANG_MODE" in
        "zh") echo "监听端口: $PORT" ;;
        *) echo "Listening port: $PORT" ;;
      esac ;;
    "prompt_password")
      case "$LANG_MODE" in
        "zh") echo "请输入用于访问后端 API 的密码(UFW_API_KEY): " ;;
        *) echo "Please enter password for backend API access (UFW_API_KEY): " ;;
      esac ;;
    "password_empty")
      case "$LANG_MODE" in
        "zh") echo "密码不能为空。" ;;
        *) echo "Password cannot be empty." ;;
      esac ;;
    "prompt_password_confirm")
      case "$LANG_MODE" in
        "zh") echo "请再次输入密码确认: " ;;
        *) echo "Please enter password again to confirm: " ;;
      esac ;;
    "password_mismatch")
      case "$LANG_MODE" in
        "zh") echo "两次输入不一致。" ;;
        *) echo "Passwords do not match." ;;
      esac ;;
    "password_set")
      case "$LANG_MODE" in
        "zh") echo "API 密码已设置。" ;;
        *) echo "API password has been set." ;;
      esac ;;
    "prompt_cors")
      case "$LANG_MODE" in
        "zh") echo "请输入允许跨域的来源(可多项, 逗号分隔)：" ;;
        *) echo "Please enter allowed CORS origins (multiple items, comma separated): " ;;
      esac ;;
    "cors_origins")
      case "$LANG_MODE" in
        "zh") echo "CORS 允许来源: $CORS_ALLOWED_ORIGINS" ;;
        *) echo "CORS allowed origins: $CORS_ALLOWED_ORIGINS" ;;
      esac ;;
    "prompt_max_fails")
      case "$LANG_MODE" in
        "zh") echo "请输入同一 IP 最大失败次数阈值 MAX_FAILS (默认 $2)：" ;;
        *) echo "Please enter maximum failure threshold for same IP MAX_FAILS (default $2): " ;;
      esac ;;
    "invalid_max_fails")
      case "$LANG_MODE" in
        "zh") echo "无效 MAX_FAILS: $2" ;;
        *) echo "Invalid MAX_FAILS: $2" ;;
      esac ;;
    "max_fails_set")
      case "$LANG_MODE" in
        "zh") echo "MAX_FAILS: $MAX_FAILS" ;;
        *) echo "MAX_FAILS: $MAX_FAILS" ;;
      esac ;;
    "prompt_timeout")
      case "$LANG_MODE" in
        "zh") echo "请输入 UFW 命令超时时间(秒) UFW_TIMEOUT_SEC (默认 $2)：" ;;
        *) echo "Please enter UFW command timeout (seconds) UFW_TIMEOUT_SEC (default $2): " ;;
      esac ;;
    "invalid_timeout")
      case "$LANG_MODE" in
        "zh") echo "无效 UFW_TIMEOUT_SEC: $2" ;;
        *) echo "Invalid UFW_TIMEOUT_SEC: $2" ;;
      esac ;;
    "timeout_set")
      case "$LANG_MODE" in
        "zh") echo "UFW_TIMEOUT_SEC: $UFW_TIMEOUT_SEC" ;;
        *) echo "UFW_TIMEOUT_SEC: $UFW_TIMEOUT_SEC" ;;
      esac ;;
    "prompt_use_sudo")
      case "$LANG_MODE" in
        "zh") echo "服务是否以非 root 用户运行、需要在后端中使用 sudo 执行 ufw？(y/N，默认 $2)：" ;;
        *) echo "Should the service run as non-root user and use sudo for ufw commands? (y/N, default $2): " ;;
      esac ;;
    "sudo_enabled")
      case "$LANG_MODE" in
        "zh") echo "UFW_SUDO=1" ;;
        *) echo "UFW_SUDO=1" ;;
      esac ;;
    "sudo_disabled")
      case "$LANG_MODE" in
        "zh") echo "UFW_SUDO=0 (以 root 运行或不需要 sudo)" ;;
        *) echo "UFW_SUDO=0 (running as root or no sudo needed)" ;;
      esac ;;
    "prompt_tls_cert")
      case "$LANG_MODE" in
        "zh") echo "如需自定义 TLS 证书路径，请输入证书文件路径(留空跳过, 后端将自签)：" ;;
        *) echo "If you need custom TLS certificate path, enter certificate file path (leave empty to skip, backend will use self-signed): " ;;
      esac ;;
    "prompt_tls_key")
      case "$LANG_MODE" in
        "zh") echo "如需自定义 TLS 私钥路径，请输入私钥文件路径(留空跳过)：" ;;
        *) echo "If you need custom TLS private key path, enter private key file path (leave empty to skip): " ;;
      esac ;;
    "tls_cert_only_warning")
      case "$LANG_MODE" in
        "zh") echo "仅提供了证书路径，未提供私钥路径，将忽略自定义证书并使用自签。" ;;
        *) echo "Only certificate path provided, no private key path. Will ignore custom certificate and use self-signed." ;;
      esac ;;
    "tls_key_only_warning")
      case "$LANG_MODE" in
        "zh") echo "仅提供了私钥路径，未提供证书路径，将忽略自定义证书并使用自签。" ;;
        *) echo "Only private key path provided, no certificate path. Will ignore custom certificate and use self-signed." ;;
      esac ;;
    "tls_cert_not_found")
      case "$LANG_MODE" in
        "zh") echo "证书文件不存在: $TLS_CERT_PATH" ;;
        *) echo "Certificate file not found: $TLS_CERT_PATH" ;;
      esac ;;
    "tls_key_not_found")
      case "$LANG_MODE" in
        "zh") echo "私钥文件不存在: $TLS_KEY_PATH" ;;
        *) echo "Private key file not found: $TLS_KEY_PATH" ;;
      esac ;;
    "tls_custom_cert")
      case "$LANG_MODE" in
        "zh") echo "将使用自定义证书：$TLS_CERT_PATH / $TLS_KEY_PATH" ;;
        *) echo "Will use custom certificate: $TLS_CERT_PATH / $TLS_KEY_PATH" ;;
      esac ;;
    "tls_self_signed")
      case "$LANG_MODE" in
        "zh") echo "未提供自定义证书，将由后端自动生成自签证书。" ;;
        *) echo "No custom certificate provided, backend will automatically generate self-signed certificate." ;;
      esac ;;
    "downloading_backend")
      case "$LANG_MODE" in
        "zh") echo "下载后端可执行文件..." ;;
        *) echo "Downloading backend executable..." ;;
      esac ;;
    "download_failed")
      case "$LANG_MODE" in
        "zh") echo "下载失败，请检查网络。" ;;
        *) echo "Download failed, please check network connection." ;;
      esac ;;
    "download_complete")
      case "$LANG_MODE" in
        "zh") echo "下载完成并已赋予执行权限。" ;;
        *) echo "Download completed and execution permission granted." ;;
      esac ;;
    "env_file_created")
      case "$LANG_MODE" in
        "zh") echo "已生成环境文件：$ENV_FILE" ;;
        *) echo "Environment file created: $ENV_FILE" ;;
      esac ;;
    "systemd_service_created")
      case "$LANG_MODE" in
        "zh") echo "已生成 systemd 服务文件：$SERVICE_FILE" ;;
        *) echo "systemd service file created: $SERVICE_FILE" ;;
      esac ;;
    "ufw_port_allowed")
      case "$LANG_MODE" in
        "zh") echo "已通过 UFW 放行 ${PORT}/tcp" ;;
        *) echo "Allowed ${PORT}/tcp through UFW" ;;
      esac ;;
    "ufw_inactive_warning")
      case "$LANG_MODE" in
        "zh") echo "UFW 当前未激活，跳过预放行 ${PORT}/tcp（后端启动后也会自放行）。" ;;
        *) echo "UFW is not currently active, skipping pre-allow ${PORT}/tcp (backend will auto-allow after startup)." ;;
      esac ;;
    "service_started")
      case "$LANG_MODE" in
        "zh") echo "服务 $SERVICE_NAME 启动成功。" ;;
        *) echo "Service $SERVICE_NAME started successfully." ;;
      esac ;;
    "service_start_failed")
      case "$LANG_MODE" in
        "zh") echo "服务启动失败：journalctl -u $SERVICE_NAME -e --no-pager" ;;
        *) echo "Service startup failed: journalctl -u $SERVICE_NAME -e --no-pager" ;;
      esac ;;
    "upgrade_complete")
      case "$LANG_MODE" in
        "zh") echo "升级完成并已重新启动服务。" ;;
        *) echo "Upgrade completed and service restarted." ;;
      esac ;;
    "service_restart_failed")
      case "$LANG_MODE" in
        "zh") echo "服务重启失败：journalctl -u $SERVICE_NAME -e --no-pager" ;;
        *) echo "Service restart failed: journalctl -u $SERVICE_NAME -e --no-pager" ;;
      esac ;;
    "deployment_complete")
      case "$LANG_MODE" in
        "zh") echo "✅ 部署完成" ;;
        *) echo "✅ Deployment completed" ;;
      esac ;;
    "service_name")
      case "$LANG_MODE" in
        "zh") echo "服务名称: $SERVICE_NAME" ;;
        *) echo "Service name: $SERVICE_NAME" ;;
      esac ;;
    "listening_port_info")
      case "$LANG_MODE" in
        "zh") echo "监听端口: $PORT" ;;
        *) echo "Listening port: $PORT" ;;
      esac ;;
    "executable_path")
      case "$LANG_MODE" in
        "zh") echo "执行路径: $EXECUTABLE_PATH" ;;
        *) echo "Executable path: $EXECUTABLE_PATH" ;;
      esac ;;
    "env_file_path")
      case "$LANG_MODE" in
        "zh") echo "环境文件: $ENV_FILE" ;;
        *) echo "Environment file: $ENV_FILE" ;;
      esac ;;
    "systemd_file_path")
      case "$LANG_MODE" in
        "zh") echo "systemd 文件: $SERVICE_FILE" ;;
        *) echo "systemd file: $SERVICE_FILE" ;;
      esac ;;
    "common_commands")
      case "$LANG_MODE" in
        "zh") echo "常用命令：" ;;
        *) echo "Common commands:" ;;
      esac ;;
    "check_status")
      case "$LANG_MODE" in
        "zh") echo "  查看状态: systemctl status $SERVICE_NAME" ;;
        *) echo "  Check status: systemctl status $SERVICE_NAME" ;;
      esac ;;
    "stop_service")
      case "$LANG_MODE" in
        "zh") echo "  停止服务: systemctl stop $SERVICE_NAME" ;;
        *) echo "  Stop service: systemctl stop $SERVICE_NAME" ;;
      esac ;;
    "start_service")
      case "$LANG_MODE" in
        "zh") echo "  启动服务: systemctl start $SERVICE_NAME" ;;
        *) echo "  Start service: systemctl start $SERVICE_NAME" ;;
      esac ;;
    "restart_service")
      case "$LANG_MODE" in
        "zh") echo "  重启服务: systemctl restart $SERVICE_NAME" ;;
        *) echo "  Restart service: systemctl restart $SERVICE_NAME" ;;
      esac ;;
    "view_logs")
      case "$LANG_MODE" in
        "zh") echo "  查看日志: journalctl -u $SERVICE_NAME -f" ;;
        *) echo "  View logs: journalctl -u $SERVICE_NAME -f" ;;
      esac ;;
  esac
}

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
  [[ $(id -u) -eq 0 ]] || log_error_exit "$(get_text 'root_required')"
}

detect_arch() {
  case "$(uname -m)" in
    x86_64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) log_error_exit "$(get_text 'arch_unsupported')" ;;
  esac
  log_info "$(get_text 'arch_detected')"
}

ensure_ufw_installed() {
  if ! command -v ufw >/dev/null 2>&1; then
    log_info "$(get_text 'ufw_not_detected')"
    if command -v apt-get >/dev/null 2>&1; then
      apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y ufw
    elif command -v dnf >/dev/null 2>&1; then
      dnf install -y ufw
    elif command -v yum >/dev/null 2>&1; then
      yum install -y ufw
    else
      log_error_exit "$(get_text 'ufw_auto_install_failed')"
    fi
  else
    log_info "$(get_text 'ufw_detected')"
  fi
  systemctl enable --now ufw
  systemctl is-active --quiet ufw || log_error_exit "$(get_text 'ufw_start_failed')"
  log_info "$(get_text 'ufw_enabled')"
}

update_ufw_after_rules() {
  local f="/etc/ufw/after.rules"
  [[ -f $f ]] && cp "$f" "${f}.bak.$(date +%s)" && log_info "$(get_text 'after_rules_backup')"
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
  ufw reload && log_info "$(get_text 'after_rules_updated')"
}

fetch_latest_backend_url() {
  log_info "$(get_text 'fetching_latest')"
  BACKEND_URL=$(curl -fsSL "$GITHUB_API" | grep '"browser_download_url"' | grep "$ARCH" | grep "$EXECUTABLE_NAME" | cut -d '"' -f 4 || true)
  [[ -n ${BACKEND_URL:-} ]] || log_error_exit "$(get_text 'version_not_found')"
  log_info "$(get_text 'download_url')"
}

trim_commas() {
  local s="$1"
  s="${s//，/,}"                # Chinese comma to English comma
  s="$(echo "$s" | sed 's/ \{1,\}//g')"  # Remove all spaces
  echo "$s"
}

prompt_port() {
  local d=30737
  read -p "$(echo -e "${yellow}$(get_text 'prompt_port' '' $d)${plain}")" p
  PORT=${p:-$d}
  [[ $PORT =~ ^[0-9]+$ && $PORT -ge 1 && $PORT -le 65535 ]] || log_error_exit "$(get_text 'invalid_port')"
  log_info "$(get_text 'listening_port')"
}

prompt_password() {
  while true; do
    read -s -p "$(echo -e "${yellow}$(get_text 'prompt_password')${plain}")" pwd; echo
    [[ -n $pwd ]] || { echo -e "${red}[ERROR]${plain} $(get_text 'password_empty')"; continue; }
    read -s -p "$(echo -e "${yellow}$(get_text 'prompt_password_confirm')${plain}")" pwd2; echo
    [[ $pwd == $pwd2 ]] || { echo -e "${red}[ERROR]${plain} $(get_text 'password_mismatch')"; continue; }
    PASSWORD=$pwd
    break
  done
  log_info "$(get_text 'password_set')"
}

prompt_cors_origins() {
  read -p "$(echo -e "${yellow}$(get_text 'prompt_cors')${plain}")" cors
  cors="${cors:-http://localhost:3000}"
  CORS_ALLOWED_ORIGINS="$(trim_commas "$cors")"
  log_info "$(get_text 'cors_origins')"
}

prompt_max_fails() {
  local d=5
  read -p "$(echo -e "${yellow}$(get_text 'prompt_max_fails' '' $d)${plain}")" mf
  mf=${mf:-$d}
  [[ $mf =~ ^[0-9]+$ && $mf -ge 1 && $mf -le 50 ]] || log_error_exit "$(get_text 'invalid_max_fails' '' $mf)"
  MAX_FAILS="$mf"
  log_info "$(get_text 'max_fails_set')"
}

prompt_timeout() {
  local d=5
  read -p "$(echo -e "${yellow}$(get_text 'prompt_timeout' '' $d)${plain}")" ts
  ts=${ts:-$d}
  [[ $ts =~ ^[0-9]+$ && $ts -ge 1 && $ts -le 60 ]] || log_error_exit "$(get_text 'invalid_timeout' '' $ts)"
  UFW_TIMEOUT_SEC="$ts"
  log_info "$(get_text 'timeout_set')"
}

prompt_use_sudo() {
  local default_choice="n"
  read -p "$(echo -e "${yellow}$(get_text 'prompt_use_sudo' '' $default_choice)${plain}")" yn
  case "${yn:-$default_choice}" in
    y|Y) UFW_SUDO=1; log_info "$(get_text 'sudo_enabled')" ;;
    *)   UFW_SUDO=0; log_info "$(get_text 'sudo_disabled')" ;;
  esac
}

prompt_tls_paths() {
  read -p "$(echo -e "${yellow}$(get_text 'prompt_tls_cert')${plain}")" TLS_CERT_PATH
  read -p "$(echo -e "${yellow}$(get_text 'prompt_tls_key')${plain}")" TLS_KEY_PATH
  if [[ -n "${TLS_CERT_PATH}" && -z "${TLS_KEY_PATH}" ]]; then
    log_warn "$(get_text 'tls_cert_only_warning')"
    TLS_CERT_PATH=""
  fi
  if [[ -n "${TLS_KEY_PATH}" && -z "${TLS_CERT_PATH}" ]]; then
    log_warn "$(get_text 'tls_key_only_warning')"
    TLS_KEY_PATH=""
  fi
  if [[ -n "${TLS_CERT_PATH}" && -n "${TLS_KEY_PATH}" ]]; then
    [[ -f "$TLS_CERT_PATH" ]] || log_error_exit "$(get_text 'tls_cert_not_found')"
    [[ -f "$TLS_KEY_PATH"  ]] || log_error_exit "$(get_text 'tls_key_not_found')"
    log_info "$(get_text 'tls_custom_cert')"
  else
    log_info "$(get_text 'tls_self_signed')"
  fi
}

download_backend() {
  log_info "$(get_text 'downloading_backend')"
  mkdir -p "$INSTALL_DIR"
  curl -fL --progress-bar "$BACKEND_URL" -o "$EXECUTABLE_PATH" || log_error_exit "$(get_text 'download_failed')"
  chmod +x "$EXECUTABLE_PATH"
  log_info "$(get_text 'download_complete')"
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
  log_info "$(get_text 'env_file_created')"
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
# Optionally specify non-root user (if configured and UFW_SUDO=1 needed, requires sudoers configuration)
# User=ufwpanel
# Group=ufwpanel

[Install]
WantedBy=multi-user.target
EOF
  log_info "$(get_text 'systemd_service_created')"
}

allow_api_port() {
  if command -v ufw >/dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
      ufw allow "${PORT}/tcp" || true
      log_info "$(get_text 'ufw_port_allowed')"
    else
      log_warn "$(get_text 'ufw_inactive_warning')"
    fi
  fi
}

enable_and_start_service() {
  systemctl daemon-reload
  systemctl enable --now "$SERVICE_NAME"
  sleep 2
  systemctl is-active --quiet "$SERVICE_NAME" && log_info "$(get_text 'service_started')" || log_error_exit "$(get_text 'service_start_failed')"
}

upgrade_flow() {
  fetch_latest_backend_url
  systemctl stop "$SERVICE_NAME"
  download_backend
  systemctl start "$SERVICE_NAME"
  sleep 2
  systemctl is-active --quiet "$SERVICE_NAME" && log_info "$(get_text 'upgrade_complete')" || log_error_exit "$(get_text 'service_restart_failed')"
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
  log_info "$(get_text 'deployment_complete')"
  log_info "$(get_text 'service_name')"
  log_info "$(get_text 'listening_port_info')"
  log_info "$(get_text 'executable_path')"
  log_info "$(get_text 'env_file_path')"
  log_info "$(get_text 'systemd_file_path')"
  echo
  log_info "$(get_text 'common_commands')"
  log_info "$(get_text 'check_status')"
  log_info "$(get_text 'stop_service')"
  log_info "$(get_text 'start_service')"
  log_info "$(get_text 'restart_service')"
  log_info "$(get_text 'view_logs')"
}

show_usage() {
  echo "Usage: $0 [LANGUAGE]"
  echo "LANGUAGE: en (English, default) | zh (Chinese)"
  echo ""
  echo "Examples:"
  echo "  $0        # Use English (default)"
  echo "  $0 en     # Use English"
  echo "  $0 zh     # Use Chinese"
}

main() {
  # Handle help flag
  case "${1:-}" in
    -h|--help)
      show_usage
      exit 0
      ;;
    zh|en|"")
      LANG_MODE="${1:-en}"
      ;;
    *)
      echo "Error: Invalid language '$1'"
      show_usage
      exit 1
      ;;
  esac
  
  check_root
  detect_arch
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    upgrade_flow
  else
    install_flow
  fi
}

main "$@"

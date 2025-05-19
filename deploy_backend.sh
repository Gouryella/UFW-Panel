#!/bin/bash

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

log_info()        { echo -e "${orange}[INFO]${green} $1${plain}"; }
log_error_exit()  { echo -e "${red}[ERROR]${plain} $1" >&2; exit 1; }

check_root() {
    [[ $(id -u) -eq 0 ]] || log_error_exit "此脚本需要以 root 权限运行。请使用 sudo ./deploy_backend.sh"
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
            apt-get update -y && apt-get install -y ufw
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
    systemctl is-active --quiet ufw || log_error_exit "UFW 服务启动失败，请查看 journalctl -u ufw"
    log_info "UFW 服务已启动并设置为开机自启。"
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
    log_info "正在从 GitHub 获取最新版本信息..."
    BACKEND_URL=$(curl -s "$GITHUB_API" | grep '"browser_download_url"' | grep "$ARCH" | grep "$EXECUTABLE_NAME" | cut -d '"' -f 4)
    [[ -n $BACKEND_URL ]] || log_error_exit "未找到架构 $ARCH 的可用版本。"
    log_info "下载链接: $BACKEND_URL"
}

prompt_port() {
    local d=8080
    read -p "$(echo -e "${yellow}请输入后端服务监听端口 (默认为 $d): ${plain}")" p
    PORT=${p:-$d}
    [[ $PORT =~ ^[0-9]+$ && $PORT -ge 1 && $PORT -le 65535 ]] || log_error_exit "无效端口: $PORT"
    log_info "后端服务监听端口: $PORT"
}

prompt_password() {
    read -s -p "$(echo -e "${yellow}请输入用于访问后端 API 的密码: ${plain}")" pwd; echo
    [[ -n $pwd ]] || log_error_exit "密码不能为空。"
    read -s -p "$(echo -e "${yellow}请再次输入密码确认: ${plain}")" pwd2; echo
    [[ $pwd == $pwd2 ]] || log_error_exit "两次输入的密码不匹配。"
    PASSWORD=$pwd
    log_info "API 访问密码已设置。"
}

prompt_cors_origin() {
    while true; do
        read -p "$(echo -e "${yellow}请输入允许跨域的前端地址 (如 http://localhost:3000): ${plain}")" ori
        if [[ -z $ori ]]; then
            echo -e "${red}[ERROR]${plain} 不允许留空。"
        elif ! [[ $ori =~ ^https?://.+ ]]; then
            echo -e "${red}[ERROR]${plain} 需以 http:// 或 https:// 开头。"
        else
            CORS_ALLOWED_ORIGINS=$ori
            log_info "CORS 允许来源: $CORS_ALLOWED_ORIGINS"
            break
        fi
    done
}

download_backend() {
    log_info "下载后端可执行文件..."
    mkdir -p "$INSTALL_DIR"
    curl -L --progress-bar "$BACKEND_URL" -o "$EXECUTABLE_PATH" || log_error_exit "下载失败，请检查网络。"
    chmod +x "$EXECUTABLE_PATH"
    log_info "下载完成并已赋予执行权限。"
}

create_env_file() {
    cat > "$ENV_FILE" <<EOF
PORT=$PORT
UFW_API_KEY=$PASSWORD
CORS_ALLOWED_ORIGINS=$CORS_ALLOWED_ORIGINS
EOF
    chmod 600 "$ENV_FILE"
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
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
}

enable_and_start_service() {
    systemctl daemon-reload
    systemctl enable --now "$SERVICE_NAME"
    sleep 2
    systemctl is-active --quiet "$SERVICE_NAME" && log_info "服务 $SERVICE_NAME 启动成功。" || log_error_exit "服务启动失败，请查看 journalctl -u $SERVICE_NAME"
}

main() {
    check_root
    detect_arch
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        fetch_latest_backend_url
        systemctl stop "$SERVICE_NAME"
        download_backend
        systemctl start "$SERVICE_NAME"
        sleep 2
        systemctl is-active --quiet "$SERVICE_NAME" && log_info "升级完成并已重新启动服务。" || log_error_exit "服务重启失败，请查看 journalctl -u $SERVICE_NAME"
        exit 0
    fi
    ensure_ufw_installed
    update_ufw_after_rules
    fetch_latest_backend_url
    prompt_port
    prompt_password
    prompt_cors_origin
    download_backend
    create_env_file
    create_systemd_service
    enable_and_start_service

    echo
    log_info "✅ 后端部署完成！"
    log_info "服务名称: $SERVICE_NAME"
    log_info "监听端口: $PORT"
    log_info "执行路径: $EXECUTABLE_PATH"
    log_info "环境文件: $ENV_FILE"
    log_info "systemd 文件: $SERVICE_FILE"
    echo
    log_info "常用命令："
    log_info "  查看状态: sudo systemctl status $SERVICE_NAME"
    log_info "  停止服务: sudo systemctl stop $SERVICE_NAME"
    log_info "  启动服务: sudo systemctl start $SERVICE_NAME"
    log_info "  重启服务: sudo systemctl restart $SERVICE_NAME"
    log_info "  查看日志: sudo journalctl -u $SERVICE_NAME -f"
}

main

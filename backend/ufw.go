package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type UFWStatus struct {
	Status string   `json:"status"`
	Rules  []string `json:"rules"`
}

var (
	reRuleNumberLine = regexp.MustCompile(`^\s*\[\s*\d+\s*\]\s+.+$`)
	reDigits         = regexp.MustCompile(`^\d+$`)
	reHeaderDashes   = regexp.MustCompile(`^-{3,}$`)
)

func ufwPath() (string, error) {
	return exec.LookPath("ufw")
}

func shouldUseSudo() bool {
	return os.Getenv("UFW_SUDO") == "1"
}

func ufwTimeout() time.Duration {
	if v := os.Getenv("UFW_TIMEOUT_SEC"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n < 60 {
			return time.Duration(n) * time.Second
		}
	}
	return 5 * time.Second
}

type cmdResult struct {
	Stdout   string
	Stderr   string
	ExitCode int
}

func runUFW(args ...string) (*cmdResult, error) {
	path, err := ufwPath()
	if err != nil {
		return nil, fmt.Errorf("ufw not found: %w", err)
	}
	finalArgs := args
	if shouldUseSudo() {
		finalArgs = append([]string{path}, args...)
		path = "sudo"
	}
	ctx, cancel := context.WithTimeout(context.Background(), ufwTimeout())
	defer cancel()
	cmd := exec.CommandContext(ctx, path, finalArgs...)
	cmd.Env = append(os.Environ(), "LANG=C")
	var out, er bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &er
	err = cmd.Run()
	res := &cmdResult{
		Stdout: out.String(),
		Stderr: er.String(),
		ExitCode: func() int {
			if err == nil {
				return 0
			}
			var ee *exec.ExitError
			if errors.As(err, &ee) {
				return ee.ExitCode()
			}
			if errors.Is(err, context.DeadlineExceeded) {
				return -2
			}
			return -1
		}(),
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return res, fmt.Errorf("ufw command timeout: %s %s", path, strings.Join(finalArgs, " "))
	}
	if err != nil {
		return res, fmt.Errorf("ufw command failed: %s %s\nstderr: %s", path, strings.Join(finalArgs, " "), res.Stderr)
	}
	return res, nil
}

func runUFWForce(args ...string) (*cmdResult, error) {
	args = append([]string{"--force"}, args...)
	return runUFW(args...)
}

func validatePort(port string) error {
	if port == "" {
		return errors.New("port empty")
	}
	if strings.Contains(port, ":") {
		parts := strings.SplitN(port, ":", 2)
		if len(parts) != 2 {
			return fmt.Errorf("invalid port range: %s", port)
		}
		a, b := parts[0], parts[1]
		if err := validatePort(a); err != nil {
			return err
		}
		if err := validatePort(b); err != nil {
			return err
		}
		ai, _ := strconv.Atoi(a)
		bi, _ := strconv.Atoi(b)
		if ai > bi {
			return fmt.Errorf("invalid port range: start > end")
		}
		return nil
	}
	n, err := strconv.Atoi(port)
	if err != nil || n < 1 || n > 65535 {
		return fmt.Errorf("invalid port: %s", port)
	}
	return nil
}

func validateProto(p string) error {
	if p == "" {
		return nil
	}
	switch strings.ToLower(p) {
	case "tcp", "udp":
		return nil
	default:
		return fmt.Errorf("invalid protocol: %s", p)
	}
}

func validateIPorCIDR(s string) error {
	if s == "" {
		return nil
	}
	if strings.Contains(s, "/") {
		if _, _, err := net.ParseCIDR(s); err != nil {
			return fmt.Errorf("invalid CIDR: %s", s)
		}
		return nil
	}
	if net.ParseIP(s) == nil {
		return fmt.Errorf("invalid IP: %s", s)
	}
	return nil
}

func validateComment(c string) error {
	if len(c) > 80 {
		return fmt.Errorf("comment too long (<=80)")
	}
	if strings.ContainsAny(c, "\n\r\t`$&|;<>()\\\"'") {
		return fmt.Errorf("comment contains illegal chars")
	}
	return nil
}

func GetUFWStatus() (*UFWStatus, error) {
	res, err := runUFW("status", "numbered")
	if err != nil {
		if res != nil && (strings.Contains(res.Stderr, "Status: inactive") || strings.Contains(res.Stdout, "Status: inactive") || strings.Contains(res.Stdout, "inactive")) {
			return &UFWStatus{Status: "inactive", Rules: []string{}}, nil
		}
		return nil, err
	}

	out := strings.TrimSpace(res.Stdout)
	if out == "" {
		return nil, fmt.Errorf("empty output from ufw status")
	}

	lines := strings.Split(strings.ReplaceAll(out, "\r\n", "\n"), "\n")
	for i := range lines {
		lines[i] = strings.TrimRight(lines[i], " \t")
	}

	status := &UFWStatus{Status: "unknown", Rules: []string{}}
	if len(lines) > 0 && strings.HasPrefix(strings.TrimSpace(lines[0]), "Status:") {
		status.Status = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(lines[0]), "Status:"))
	}

	for _, ln := range lines {
		if reRuleNumberLine.MatchString(ln) {
			status.Rules = append(status.Rules, strings.TrimSpace(ln))
		}
	}

	if len(status.Rules) == 0 {
		start := -1
		for i, ln := range lines {
			s := strings.ToLower(strings.TrimSpace(ln))
			if strings.Contains(s, "action") && strings.Contains(s, "from") {
				start = i + 1
				break
			}
		}
		if start != -1 {
			if start < len(lines) && reHeaderDashes.MatchString(strings.TrimSpace(lines[start])) {
				start++
			}
			for i := start; i < len(lines); i++ {
				l := strings.TrimSpace(lines[i])
				if l == "" {
					continue
				}
				if strings.HasPrefix(strings.ToLower(l), "logging") {
					continue
				}
				status.Rules = append(status.Rules, l)
			}
		}
	}

	return status, nil
}

func AllowUFWPort(rule string, comment string) error {
	rule = strings.TrimSpace(rule)
	if rule == "" {
		return fmt.Errorf("rule cannot be empty")
	}
	parts := strings.Split(rule, "/")
	switch len(parts) {
	case 1:
		if _, err := strconv.Atoi(parts[0]); err == nil || strings.Contains(parts[0], ":") {
			if err := validatePort(parts[0]); err != nil {
				return err
			}
		}
	case 2:
		if parts[0] != "" {
			if _, err := strconv.Atoi(parts[0]); err == nil || strings.Contains(parts[0], ":") {
				if err := validatePort(parts[0]); err != nil {
					return err
				}
			}
		}
		if err := validateProto(parts[1]); err != nil {
			return err
		}
	default:
		return fmt.Errorf("invalid rule format: %s", rule)
	}
	if comment != "" {
		if err := validateComment(comment); err != nil {
			return err
		}
	}
	args := []string{"allow", rule}
	if comment != "" {
		args = append(args, "comment", comment)
	}
	if _, err := runUFW(args...); err != nil {
		if strings.Contains(err.Error(), "Skipping adding existing rule") {
			return nil
		}
		return err
	}
	return nil
}

func DenyUFWPort(rule string, comment string) error {
	rule = strings.TrimSpace(rule)
	if rule == "" {
		return fmt.Errorf("rule cannot be empty")
	}
	parts := strings.Split(rule, "/")
	switch len(parts) {
	case 1:
		if _, err := strconv.Atoi(parts[0]); err == nil || strings.Contains(parts[0], ":") {
			if err := validatePort(parts[0]); err != nil {
				return err
			}
		}
	case 2:
		if parts[0] != "" {
			if _, err := strconv.Atoi(parts[0]); err == nil || strings.Contains(parts[0], ":") {
				if err := validatePort(parts[0]); err != nil {
					return err
				}
			}
		}
		if err := validateProto(parts[1]); err != nil {
			return err
		}
	default:
		return fmt.Errorf("invalid rule format: %s", rule)
	}
	if comment != "" {
		if err := validateComment(comment); err != nil {
			return err
		}
	}
	args := []string{"deny", rule}
	if comment != "" {
		args = append(args, "comment", comment)
	}
	if _, err := runUFW(args...); err != nil {
		if strings.Contains(err.Error(), "Skipping adding existing rule") {
			return nil
		}
		return err
	}
	return nil
}

func DeleteUFWByNumber(ruleNumber string) error {
	ruleNumber = strings.TrimSpace(ruleNumber)
	if !reDigits.MatchString(ruleNumber) || ruleNumber == "0" {
		return fmt.Errorf("invalid rule number: %s", ruleNumber)
	}
	res, err := runUFWForce("delete", ruleNumber)
	if err != nil {
		if res != nil && (strings.Contains(res.Stderr, "Rule not found") || strings.Contains(err.Error(), "Rule not found")) {
			return fmt.Errorf("rule number %s not found", ruleNumber)
		}
		return err
	}
	_ = res
	return nil
}

func EnableUFW() error {
	res, err := runUFWForce("enable")
	if err != nil {
		if res != nil && (strings.Contains(res.Stderr, "already active") || strings.Contains(res.Stdout, "already active")) {
			return nil
		}
		return err
	}
	return nil
}

func DisableUFW() error {
	res, err := runUFW("disable")
	if err != nil {
		if res != nil && (strings.Contains(res.Stderr, "not active") || strings.Contains(res.Stdout, "not active")) {
			return nil
		}
		return err
	}
	return nil
}

func AllowUFWFromIP(ipAddress string, portProto string, comment string) error {
	ipAddress = strings.TrimSpace(ipAddress)
	if ipAddress == "" {
		return fmt.Errorf("ip address cannot be empty")
	}
	if err := validateIPorCIDR(ipAddress); err != nil {
		return err
	}
	pp := strings.TrimSpace(portProto)
	var port, proto string
	if pp != "" {
		if strings.Contains(pp, "/") {
			parts := strings.SplitN(pp, "/", 2)
			port = strings.TrimSpace(parts[0])
			proto = strings.TrimSpace(parts[1])
		} else {
			if _, err := strconv.Atoi(pp); err == nil || strings.Contains(pp, ":") {
				port = pp
			} else {
				proto = pp
			}
		}
	}
	if port != "" {
		if err := validatePort(port); err != nil {
			return err
		}
	}
	if proto != "" {
		if err := validateProto(proto); err != nil {
			return err
		}
	}
	if comment != "" {
		if err := validateComment(comment); err != nil {
			return err
		}
	}
	args := []string{"allow", "from", ipAddress, "to", "any"}
	if port != "" {
		args = append(args, "port", port)
	}
	if proto != "" {
		args = append(args, "proto", proto)
	}
	if comment != "" {
		args = append(args, "comment", comment)
	}
	if _, err := runUFW(args...); err != nil {
		if strings.Contains(err.Error(), "Skipping adding existing rule") {
			return nil
		}
		return err
	}
	return nil
}

func DenyUFWFromIP(ipAddress string, portProto string, comment string) error {
	ipAddress = strings.TrimSpace(ipAddress)
	if ipAddress == "" {
		return fmt.Errorf("ip address cannot be empty")
	}
	if err := validateIPorCIDR(ipAddress); err != nil {
		return err
	}
	pp := strings.TrimSpace(portProto)
	var port, proto string
	if pp != "" {
		if strings.Contains(pp, "/") {
			parts := strings.SplitN(pp, "/", 2)
			port = strings.TrimSpace(parts[0])
			proto = strings.TrimSpace(parts[1])
		} else {
			if _, err := strconv.Atoi(pp); err == nil || strings.Contains(pp, ":") {
				port = pp
			} else {
				proto = pp
			}
		}
	}
	if port != "" {
		if err := validatePort(port); err != nil {
			return err
		}
	}
	if proto != "" {
		if err := validateProto(proto); err != nil {
			return err
		}
	}
	if comment != "" {
		if err := validateComment(comment); err != nil {
			return err
		}
	}
	args := []string{"deny", "from", ipAddress, "to", "any"}
	if port != "" {
		args = append(args, "port", port)
	}
	if proto != "" {
		args = append(args, "proto", proto)
	}
	if comment != "" {
		args = append(args, "comment", comment)
	}
	if _, err := runUFW(args...); err != nil {
		if strings.Contains(err.Error(), "Skipping adding existing rule") {
			return nil
		}
		return err
	}
	return nil
}

func RouteAllowUFW(protocol, fromIP, toIP, port, comment string) error {
	protocol = strings.TrimSpace(protocol)
	fromIP = strings.TrimSpace(fromIP)
	toIP = strings.TrimSpace(toIP)
	port = strings.TrimSpace(port)
	comment = strings.TrimSpace(comment)
	if protocol == "" && port == "" {
		return fmt.Errorf("invalid request: protocol or port required")
	}
	if protocol != "" {
		if err := validateProto(protocol); err != nil {
			return err
		}
	}
	if fromIP != "" && fromIP != "any" {
		if err := validateIPorCIDR(fromIP); err != nil {
			return fmt.Errorf("from ip invalid: %v", err)
		}
	}
	if toIP != "" && toIP != "any" {
		if err := validateIPorCIDR(toIP); err != nil {
			return fmt.Errorf("to ip invalid: %v", err)
		}
	}
	if port != "" {
		if err := validatePort(port); err != nil {
			return err
		}
	}
	if comment != "" {
		if err := validateComment(comment); err != nil {
			return err
		}
	}
	args := []string{"route", "allow"}
	if protocol != "" {
		args = append(args, "proto", protocol)
	}
	if fromIP == "" {
		fromIP = "any"
	}
	if toIP == "" {
		toIP = "any"
	}
	args = append(args, "from", fromIP, "to", toIP)
	if port != "" {
		args = append(args, "port", port)
	}
	if comment != "" {
		args = append(args, "comment", comment)
	}
	if _, err := runUFW(args...); err != nil {
		if strings.Contains(err.Error(), "Skipping adding existing rule") {
			return nil
		}
		return err
	}
	return nil
}

package main

import (
	"bytes"
	"fmt"
	"os/exec"
	"strings"
	"strconv"
)

type UFWStatus struct {
	Status string   `json:"status"`
	Rules  []string `json:"rules"`
}

func GetUFWStatus() (*UFWStatus, error) {
	cmdCheck := exec.Command("which", "ufw")
	if err := cmdCheck.Run(); err != nil {
		return nil, fmt.Errorf("ufw command not found or not executable: %w", err)
	}

	cmd := exec.Command("sudo", "ufw", "status", "numbered")
	var out bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		stderrStr := stderr.String()
		if strings.Contains(stderrStr, "Status: inactive") || strings.Contains(out.String(), "Status: inactive") {
			return &UFWStatus{Status: "inactive", Rules: []string{}}, nil
		}
		return nil, fmt.Errorf("failed to execute ufw status: %w\nStderr: %s", err, stderrStr)
	}

	output := out.String()
	lines := strings.Split(strings.TrimSpace(output), "\n")

	if len(lines) == 0 {
		return nil, fmt.Errorf("unexpected empty output from ufw status")
	}

	status := &UFWStatus{
		Status: "unknown",
		Rules:  []string{},
	}

	if strings.HasPrefix(lines[0], "Status:") {
		status.Status = strings.TrimSpace(strings.TrimPrefix(lines[0], "Status:"))
	}

	ruleStartIndex := -1
	for i, line := range lines {
		if strings.Contains(line, "Action") && strings.Contains(line, "From") {
			ruleStartIndex = i + 1
			if ruleStartIndex < len(lines) && strings.HasPrefix(strings.TrimSpace(lines[ruleStartIndex]), "---") {
				ruleStartIndex++
			}
			break
		}
	}

	if ruleStartIndex == -1 {
		if status.Status != "unknown" && len(lines) > 1 {
			ruleStartIndex = 1
		} else if status.Status == "unknown" && len(lines) > 0 {
			ruleStartIndex = 0
		}
	}

	if ruleStartIndex != -1 && ruleStartIndex < len(lines) {
		status.Rules = lines[ruleStartIndex:]
		for i := range status.Rules {
			status.Rules[i] = strings.TrimSpace(status.Rules[i])
		}
	}

	return status, nil
}

func AllowUFWPort(rule string, comment string) error {
	if rule == "" {
		return fmt.Errorf("rule cannot be empty")
	}

	if strings.ContainsAny(rule, ";|&`$<>\\") {
		return fmt.Errorf("invalid characters in rule string")
	}

	args := []string{"ufw", "allow"}
	args = append(args, strings.Fields(rule)...)
	if comment != "" {
		if strings.ContainsAny(comment, "'\";|&`$<>\\") {
			return fmt.Errorf("invalid characters in comment string")
		}
		args = append(args, "comment", comment)
	}

	cmd := exec.Command("sudo", args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("failed to execute ufw command '%s': %w\nStderr: %s", strings.Join(args, " "), err, stderr.String())
	}

	fmt.Printf("Successfully executed: %s\n", strings.Join(cmd.Args, " "))
	return nil
}

func DenyUFWPort(rule string, comment string) error {
	if rule == "" {
		return fmt.Errorf("rule cannot be empty")
	}
	if strings.ContainsAny(rule, ";|&`$<>\\") {
		return fmt.Errorf("invalid characters in rule string")
	}

	args := []string{"ufw", "deny"}
	args = append(args, strings.Fields(rule)...)
	if comment != "" {
		if strings.ContainsAny(comment, "'\";|&`$<>\\") {
			return fmt.Errorf("invalid characters in comment string")
		}
		args = append(args, "comment", comment)
	}

	cmd := exec.Command("sudo", args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("failed to execute ufw command '%s': %w\nStderr: %s", strings.Join(args, " "), err, stderr.String())
	}

	fmt.Printf("Successfully executed: %s\n", strings.Join(cmd.Args, " "))
	return nil
}

func DeleteUFWByNumber(ruleNumber string) error {
	for _, r := range ruleNumber {
		if r < '0' || r > '9' {
			return fmt.Errorf("invalid rule number: must be numeric")
		}
	}
	if ruleNumber == "" || ruleNumber == "0" {
		return fmt.Errorf("invalid rule number: cannot be empty or zero")
	}

	cmd := exec.Command("sudo", "ufw", "delete", ruleNumber)
	cmd.Stdin = strings.NewReader("y\n")

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		stderrStr := stderr.String()
		if strings.Contains(stderrStr, "WARN: Rule not found") {
			return fmt.Errorf("rule number %s not found", ruleNumber)
		}
		return fmt.Errorf("failed to execute ufw delete rule number %s: %w\nStderr: %s", ruleNumber, err, stderrStr)
	}

	fmt.Printf("Successfully executed: %s (with confirmation 'y')\n", strings.Join(cmd.Args, " "))
	return nil
}

func EnableUFW() error {
	cmd := exec.Command("sudo", "ufw", "enable")
	cmd.Stdin = strings.NewReader("y\n")

	var stderr bytes.Buffer
	var out bytes.Buffer
	cmd.Stderr = &stderr
	cmd.Stdout = &out

	err := cmd.Run()
	if err != nil {
		stderrStr := stderr.String()
		outStr := out.String()
		if strings.Contains(stderrStr, "Firewall is already active") || strings.Contains(outStr, "Firewall is already active") {
			fmt.Println("UFW is already active.")
			return nil
		}
		return fmt.Errorf("failed to execute ufw enable: %w\nStderr: %s\nStdout: %s", err, stderrStr, outStr)
	}

	fmt.Printf("Successfully executed: %s (with confirmation 'y')\n", strings.Join(cmd.Args, " "))
	return nil
}

func AllowUFWFromIP(ipAddress string, portProto string, comment string) error {
	if ipAddress == "" {
		return fmt.Errorf("ip address cannot be empty")
	}
	if strings.ContainsAny(ipAddress, ";|&`$<>\\ ") {
		return fmt.Errorf("invalid characters in ip address string")
	}
	if strings.ContainsAny(portProto, ";|&`$<>\\") {
		return fmt.Errorf("invalid characters in port/protocol string")
	}

	args := []string{"ufw", "allow", "from", ipAddress}
	if portProto != "" {
		if strings.Contains(portProto, "/") {
			parts := strings.SplitN(portProto, "/", 2)
			port := parts[0]
			protocol := parts[1]
			args = append(args, "to", "any", "port", port)
			if protocol != "" {
				args = append(args, "proto", protocol)
			}
		} else {
			if _, err := strconv.Atoi(portProto); err == nil {
				args = append(args, "to", "any", "port", portProto)
			} else {
				args = append(args, "proto", portProto)
			}
		}
	}
	if comment != "" {
		if strings.ContainsAny(comment, "'\";|&`$<>\\") { // Basic check
			return fmt.Errorf("invalid characters in comment string")
		}
		args = append(args, "comment", comment)
	}
	cmd := exec.Command("sudo", args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("failed to execute ufw rule '%s': %w\nStderr: %s", strings.Join(args, " "), err, stderr.String())
	}

	fmt.Printf("Successfully executed: %s\n", strings.Join(cmd.Args, " "))
	return nil
}

func DenyUFWFromIP(ipAddress string, portProto string, comment string) error {
	if ipAddress == "" {
		return fmt.Errorf("ip address cannot be empty")
	}
	if strings.ContainsAny(ipAddress, ";|&`$<>\\ ") {
		return fmt.Errorf("invalid characters in ip address string")
	}
	if strings.ContainsAny(portProto, ";|&`$<>\\") {
		return fmt.Errorf("invalid characters in port/protocol string")
	}

	args := []string{"ufw", "deny", "from", ipAddress}
	if portProto != "" {
		args = append(args, "to", "any", "port", portProto)
	}
	if comment != "" {
		if strings.ContainsAny(comment, "'\";|&`$<>\\") {
			return fmt.Errorf("invalid characters in comment string")
		}
		args = append(args, "comment", comment)
	}

	cmd := exec.Command("sudo", args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("failed to execute ufw rule '%s': %w\nStderr: %s", strings.Join(args, " "), err, stderr.String())
	}

	fmt.Printf("Successfully executed: %s\n", strings.Join(cmd.Args, " "))
	return nil
}

func RouteAllowUFW(protocol, fromIP, toIP, port, comment string) error {
	if protocol == "" && port == "" { 
	}
	if strings.ContainsAny(protocol, ";|&`$<>\\ ") { 
		return fmt.Errorf("invalid characters in protocol string")
	}
	if strings.ContainsAny(fromIP, ";|&`$<>\\ ") {
		return fmt.Errorf("invalid characters in from IP string")
	}
	if strings.ContainsAny(toIP, ";|&`$<>\\ ") {
		return fmt.Errorf("invalid characters in to IP string")
	}
	if strings.ContainsAny(port, ";|&`$<>\\ ") { 
		return fmt.Errorf("invalid characters in port string")
	}


	args := []string{"ufw", "route", "allow"}


	if protocol != "" {
		args = append(args, "proto", protocol)
	}

	if fromIP != "" {
		args = append(args, "from", fromIP)
	} else {
		args = append(args, "from", "any")
	}

	if toIP != "" {
		args = append(args, "to", toIP)
	} else {
		args = append(args, "to", "any")
	}
	
	if port != "" {
		args = append(args, "port", port)
	}

	if comment != "" {
		if strings.ContainsAny(comment, "'\";|&`$<>\\") {
			return fmt.Errorf("invalid characters in comment string")
		}
		args = append(args, "comment", comment)
	}

	cmd := exec.Command("sudo", args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("failed to execute ufw command '%s': %w\nStderr: %s", strings.Join(args, " "), err, stderr.String())
	}

	fmt.Printf("Successfully executed: %s\n", strings.Join(cmd.Args, " "))
	return nil
}

func DisableUFW() error {
	cmd := exec.Command("sudo", "ufw", "disable")
	var stderr bytes.Buffer
	var out bytes.Buffer
	cmd.Stderr = &stderr
	cmd.Stdout = &out

	err := cmd.Run()
	if err != nil {
		stderrStr := stderr.String()
		outStr := out.String()
		if strings.Contains(stderrStr, "Firewall is not active") || strings.Contains(outStr, "Firewall is not active") {
			fmt.Println("UFW is already inactive.")
			return nil
		}
		return fmt.Errorf("failed to execute ufw disable: %w\nStderr: %s\nStdout: %s", err, stderrStr, outStr)
	}

	fmt.Printf("Successfully executed: %s\n", strings.Join(cmd.Args, " "))
	return nil
}

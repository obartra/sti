package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// The box is reached over plain ssh: the same key and host the operator already
// uses. Secrets travel on stdin only, never on the command line.

func sshCapture(target, remoteCmd string) (string, error) {
	cmd := exec.Command("ssh", target, remoteCmd)
	cmd.Stderr = os.Stderr
	out, err := cmd.Output()
	return string(out), err
}

func sshPush(target, remoteCmd, stdin string) error {
	cmd := exec.Command("ssh", target, remoteCmd)
	cmd.Stdin = strings.NewReader(stdin)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// remoteEnv reads and parses the env file currently on the box. A missing file
// (nothing deployed yet) parses to an empty map, not an error.
func (c Config) remoteEnv() (map[string]string, error) {
	if c.SSH == "" {
		return nil, errors.New("set SECRETS_SSH to the box, e.g. root@origin.sti.care")
	}
	out, err := sshCapture(c.SSH, remoteReadCmd(c))
	if err != nil {
		return nil, fmt.Errorf("read remote env over ssh: %w", err)
	}
	return parseEnv(out), nil
}

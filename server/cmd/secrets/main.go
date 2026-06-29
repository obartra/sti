// Command secrets manages the server's env file (/etc/stiapi.env) as an
// age-encrypted blob committed to the repo and pushed to the box over SSH, all
// keyed to the SSH key the operator already uses. See server/deploy/SECRETS.md.
//
// The store is never plaintext on disk or in the repo: it is decrypted in memory
// to read or edit, and streamed to the box on stdin to deploy. This binary is
// deliberately separate from the CI deploy path, which may only ship the server
// binary and restart, never touch secrets.
package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"golang.org/x/term"
)

type Config struct {
	Dir         string
	SSH         string
	Identity    string
	RemotePath  string
	RemoteOwner string
	RemoteMode  string
	Service     string
	Sudo        string
	Required    []string
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func splitComma(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func loadConfig() Config {
	home, _ := os.UserHomeDir()
	return Config{
		Dir:         env("SECRETS_DIR", "deploy/secrets"),
		SSH:         os.Getenv("SECRETS_SSH"),
		Identity:    env("SECRETS_IDENTITY", filepath.Join(home, ".ssh", "id_ed25519")),
		RemotePath:  env("SECRETS_REMOTE_PATH", "/etc/stiapi.env"),
		RemoteOwner: env("SECRETS_REMOTE_OWNER", "root:stiapi"),
		RemoteMode:  env("SECRETS_REMOTE_MODE", "0640"),
		Service:     env("SECRETS_SERVICE", "stiapi"),
		Sudo:        os.Getenv("SECRETS_SUDO"),
		Required:    splitComma(env("SECRETS_REQUIRED", "STI_DECOY_SECRET")),
	}
}

func (c Config) encPath() string   { return filepath.Join(c.Dir, "stiapi.env.age") }
func (c Config) recipPath() string { return filepath.Join(c.Dir, "recipients.txt") }

// load decrypts the store with the configured SSH identity.
func (c Config) load() (string, error) {
	cipher, err := os.ReadFile(c.encPath())
	if err != nil {
		return "", fmt.Errorf("no store at %s (run 'init' first)", c.encPath())
	}
	return decrypt(cipher, c.Identity)
}

// save re-encrypts plain to every recipient and writes it atomically.
func (c Config) save(plain string) error {
	recips, err := os.ReadFile(c.recipPath())
	if err != nil {
		return fmt.Errorf("no recipients at %s (run 'init' first)", c.recipPath())
	}
	rs, err := recipientsFrom(string(recips))
	if err != nil {
		return err
	}
	cipher, err := encrypt(plain, rs)
	if err != nil {
		return err
	}
	return writeAtomic(c.encPath(), cipher, 0o644)
}

func writeAtomic(path string, data []byte, mode os.FileMode) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".tmp-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmpName, mode); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "secrets: "+err.Error())
		os.Exit(1)
	}
}

func run(args []string) error {
	cfg := loadConfig()
	if len(args) == 0 {
		usage()
		return nil
	}
	cmd, rest := args[0], args[1:]
	switch cmd {
	case "init":
		return cmdInit(cfg)
	case "list":
		return cmdList(cfg)
	case "show", "get", "view":
		return cmdShow(cfg, rest)
	case "set", "add":
		return cmdSet(cfg, rest)
	case "rm", "remove", "del":
		return cmdRm(cfg, rest)
	case "edit":
		return cmdEdit(cfg)
	case "recipients":
		return cmdRecipients(cfg, rest)
	case "diff":
		return cmdDiff(cfg)
	case "pull", "adopt":
		return cmdPull(cfg)
	case "gen-decoy":
		return cmdGenDecoy(cfg)
	case "gen-vapid":
		return cmdGenVapid(cfg)
	case "sync", "push":
		return cmdSync(cfg, rest)
	case "help", "-h", "--help":
		usage()
		return nil
	default:
		return fmt.Errorf("unknown command %q. Run 'secrets help'", cmd)
	}
}

func cmdInit(cfg Config) error {
	if err := os.MkdirAll(cfg.Dir, 0o755); err != nil {
		return err
	}
	pubPath := cfg.Identity + ".pub"
	pub, err := os.ReadFile(pubPath)
	if err != nil {
		return fmt.Errorf("read %s: %w (point SECRETS_IDENTITY at your SSH key)", pubPath, err)
	}
	line := strings.TrimSpace(string(pub))
	if err := validRecipient(line); err != nil {
		return fmt.Errorf("%s is not a usable SSH public key: %w", pubPath, err)
	}
	existing, _ := os.ReadFile(cfg.recipPath())
	if !lineExists(string(existing), line) {
		f, err := os.OpenFile(cfg.recipPath(), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			return err
		}
		fmt.Fprintln(f, line)
		if err := f.Close(); err != nil {
			return err
		}
		fmt.Printf("secrets: added %s as a recipient.\n", firstFields(line, 2))
	}
	if _, err := os.Stat(cfg.encPath()); os.IsNotExist(err) {
		if err := cfg.save(storeHeader + "\n"); err != nil {
			return err
		}
		fmt.Printf("secrets: created empty %s.\n", cfg.encPath())
	}
	fmt.Println("secrets: ready. Try 'secrets set STI_EXAMPLE hello' then 'secrets list'.")
	return nil
}

func cmdList(cfg Config) error {
	plain, err := cfg.load()
	if err != nil {
		return err
	}
	for _, k := range keysOf(plain) {
		fmt.Println(k)
	}
	return nil
}

func cmdShow(cfg Config, args []string) error {
	plain, err := cfg.load()
	if err != nil {
		return err
	}
	if len(args) == 0 {
		fmt.Print(plain)
		return nil
	}
	v, ok := parseEnv(plain)[args[0]]
	if !ok {
		return fmt.Errorf("no such key: %s", args[0])
	}
	fmt.Println(v)
	return nil
}

func cmdSet(cfg Config, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: secrets set KEY [VALUE]")
	}
	key := args[0]
	if !validKey(key) {
		return fmt.Errorf("invalid key %q (letters, digits, underscore; must not start with a digit)", key)
	}
	var value string
	if len(args) >= 2 {
		value = strings.Join(args[1:], " ")
	} else {
		v, err := promptSecret(fmt.Sprintf("Value for %s: ", key))
		if err != nil {
			return err
		}
		value = v
	}
	if strings.ContainsAny(value, "\n\r") {
		return fmt.Errorf("value cannot contain a newline")
	}
	plain, err := cfg.load()
	if err != nil {
		return err
	}
	if err := cfg.save(upsert(plain, key, value)); err != nil {
		return err
	}
	fmt.Printf("secrets: set %s.\n", key)
	return nil
}

func cmdRm(cfg Config, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: secrets rm KEY")
	}
	plain, err := cfg.load()
	if err != nil {
		return err
	}
	next, removed := removeKey(plain, args[0])
	if !removed {
		return fmt.Errorf("no such key: %s", args[0])
	}
	if err := cfg.save(next); err != nil {
		return err
	}
	fmt.Printf("secrets: removed %s.\n", args[0])
	return nil
}

func cmdEdit(cfg Config) error {
	plain, err := cfg.load()
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp("", "stiapi-env-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := os.Chmod(tmpName, 0o600); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.WriteString(plain); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}

	editor := env("VISUAL", os.Getenv("EDITOR"))
	if editor == "" {
		editor = "vi"
	}
	fields := strings.Fields(editor)
	c := exec.Command(fields[0], append(fields[1:], tmpName)...)
	c.Stdin, c.Stdout, c.Stderr = os.Stdin, os.Stdout, os.Stderr
	if err := c.Run(); err != nil {
		return fmt.Errorf("editor: %w", err)
	}
	edited, err := os.ReadFile(tmpName)
	if err != nil {
		return err
	}
	if string(edited) == plain {
		fmt.Println("secrets: no change.")
		return nil
	}
	if err := cfg.save(string(edited)); err != nil {
		return err
	}
	fmt.Println("secrets: saved.")
	return nil
}

func cmdRecipients(cfg Config, args []string) error {
	switch {
	case len(args) == 0:
		b, err := os.ReadFile(cfg.recipPath())
		if err != nil {
			return fmt.Errorf("no recipients (run 'init')")
		}
		fmt.Print(string(b))
		return nil
	case args[0] == "add":
		return recipientsAdd(cfg, strings.Join(args[1:], " "))
	case args[0] == "rm" || args[0] == "remove":
		return recipientsRm(cfg, strings.Join(args[1:], " "))
	default:
		return fmt.Errorf("usage: secrets recipients [add KEY | rm LABEL]")
	}
}

func recipientsAdd(cfg Config, key string) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return fmt.Errorf("usage: secrets recipients add 'ssh-ed25519 AAAA... label'")
	}
	if err := validRecipient(key); err != nil {
		return fmt.Errorf("not an SSH public key: %w", err)
	}
	existing, _ := os.ReadFile(cfg.recipPath())
	if lineExists(string(existing), key) {
		return fmt.Errorf("already a recipient")
	}
	plain, err := cfg.load() // decrypt while the recipient set is unchanged
	if err != nil {
		return err
	}
	f, err := os.OpenFile(cfg.recipPath(), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	fmt.Fprintln(f, key)
	if err := f.Close(); err != nil {
		return err
	}
	if err := cfg.save(plain); err != nil {
		return err
	}
	fmt.Printf("secrets: added recipient %s and re-encrypted.\n", firstFields(key, 2))
	return nil
}

func recipientsRm(cfg Config, arg string) error {
	arg = strings.TrimSpace(arg)
	if arg == "" {
		return fmt.Errorf("usage: secrets recipients rm <label-or-key>")
	}
	b, err := os.ReadFile(cfg.recipPath())
	if err != nil {
		return fmt.Errorf("no recipients (run 'init')")
	}
	var kept []string
	matched := 0
	for _, l := range strings.Split(strings.TrimRight(string(b), "\n"), "\n") {
		if recipientMatches(l, arg) {
			matched++
			continue
		}
		kept = append(kept, l)
	}
	if matched == 0 {
		return fmt.Errorf("no recipient matched %q; current:\n%s", arg, strings.TrimRight(string(b), "\n"))
	}
	if len(kept) == 0 {
		return fmt.Errorf("refusing to remove the last recipient (you would lose access)")
	}
	plain, err := cfg.load() // decrypt before we drop a key we might be using
	if err != nil {
		return err
	}
	if err := writeAtomic(cfg.recipPath(), []byte(strings.Join(kept, "\n")+"\n"), 0o644); err != nil {
		return err
	}
	if err := cfg.save(plain); err != nil {
		return err
	}
	fmt.Printf("secrets: removed %d recipient(s) and re-encrypted.\n", matched)
	return nil
}

func cmdDiff(cfg Config) error {
	plain, err := cfg.load()
	if err != nil {
		return err
	}
	remote, err := cfg.remoteEnv()
	if err != nil {
		return err
	}
	printDiff(cfg, diffEnv(parseEnv(plain), remote))
	return nil
}

func cmdSync(cfg Config, args []string) error {
	yes := false
	for _, a := range args {
		if a == "-y" || a == "--yes" {
			yes = true
		}
	}
	if cfg.SSH == "" {
		return fmt.Errorf("set SECRETS_SSH to the box, e.g. root@origin.sti.care")
	}
	plain, err := cfg.load()
	if err != nil {
		return err
	}
	if strings.TrimSpace(plain) == "" {
		return fmt.Errorf("refusing to push an empty store")
	}
	if miss := missingRequired(parseEnv(plain), cfg.Required); len(miss) > 0 {
		return fmt.Errorf("missing required key(s): %s (set them, or override SECRETS_REQUIRED)", strings.Join(miss, ", "))
	}
	remote, err := cfg.remoteEnv()
	if err != nil {
		return err
	}
	d := diffEnv(parseEnv(plain), remote)
	printDiff(cfg, d)
	if d.empty() {
		return nil
	}
	if !yes {
		ok, err := confirm(fmt.Sprintf("Push to %s and restart %s? [y/N] ", cfg.SSH, cfg.Service))
		if err != nil {
			return err
		}
		if !ok {
			fmt.Println("secrets: aborted.")
			return nil
		}
	}
	fmt.Printf("secrets: pushing to %s:%s and restarting %s...\n", cfg.SSH, cfg.RemotePath, cfg.Service)
	body := strings.TrimRight(plain, "\n") + "\n"
	if err := sshPush(cfg.SSH, remoteInstallCmd(cfg), body); err != nil {
		return fmt.Errorf("sync failed (service may not be active): %w", err)
	}
	fmt.Printf("secrets: synced and %s is active.\n", cfg.Service)
	return nil
}

func printDiff(cfg Config, d EnvDiff) {
	if d.empty() {
		fmt.Printf("secrets: %s on %s already matches the local store.\n", cfg.RemotePath, cfg.SSH)
		return
	}
	fmt.Printf("Changes 'sync' would push to %s:%s\n", cfg.SSH, cfg.RemotePath)
	for _, k := range d.Added {
		fmt.Printf("  + %s (new)\n", k)
	}
	for _, k := range d.Changed {
		fmt.Printf("  ~ %s (value changes)\n", k)
	}
	for _, k := range d.Removed {
		fmt.Printf("  - %s (removed on the box)\n", k)
	}
}

// lineExists reports whether the recipients text already contains key, matched by
// its base64 body so a re-paste with a different label is still a duplicate.
func lineExists(text, key string) bool {
	kf := strings.Fields(key)
	if len(kf) < 2 {
		return strings.Contains(text, strings.TrimSpace(key))
	}
	for _, l := range strings.Split(text, "\n") {
		lf := strings.Fields(l)
		if len(lf) >= 2 && lf[1] == kf[1] {
			return true
		}
	}
	return false
}

// recipientMatches reports whether a recipients line is the one identified by arg,
// matched on any whole field (label, key body, or type) or the "type body" pair.
func recipientMatches(line, arg string) bool {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, "#") {
		return false
	}
	f := strings.Fields(line)
	for _, x := range f {
		if x == arg {
			return true
		}
	}
	return len(f) >= 2 && arg == f[0]+" "+f[1]
}

func promptSecret(prompt string) (string, error) {
	if term.IsTerminal(int(os.Stdin.Fd())) {
		fmt.Fprint(os.Stderr, prompt)
		b, err := term.ReadPassword(int(os.Stdin.Fd()))
		fmt.Fprintln(os.Stderr)
		if err != nil {
			return "", err
		}
		return string(b), nil
	}
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && line == "" {
		return "", err
	}
	return strings.TrimRight(line, "\r\n"), nil
}

func confirm(prompt string) (bool, error) {
	fmt.Fprint(os.Stderr, prompt)
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && line == "" {
		return false, err
	}
	a := strings.ToLower(strings.TrimSpace(line))
	return a == "y" || a == "yes", nil
}

func usage() {
	cfg := loadConfig()
	fmt.Print(`secrets: manage the server's env secrets (/etc/stiapi.env), encrypted in the repo
with your SSH key. Read, edit, and push them with the same key you use for SSH.

Usage: secrets <command> [args]

Commands:
  list                   list key names, values masked
  show [KEY]             print every secret, or just KEY (plaintext)
  set KEY [VALUE]        add or update a key; prompts for VALUE if omitted (no echo)
  rm KEY                 remove a key
  edit                   open the whole file in $EDITOR, re-encrypt on save
  diff                   show what 'sync' would change on the box (key by key)
  pull                   adopt the box's current env: copy in every key the store
                         does not already define (a staged local edit wins). Run
                         this first when the store is empty, so 'sync' shows only
                         your changes instead of proposing to wipe the box.
  gen-decoy              generate a fresh STI_DECOY_SECRET and set it in the store
  gen-vapid              generate a fresh Web Push VAPID keypair (STI_VAPID_PUBLIC_KEY
                         + STI_VAPID_PRIVATE_KEY) and set both in the store
  sync [-y]              push to the box over SSH and restart; shows the diff and
                         asks first unless -y is given
  recipients [add KEY | rm LABEL]
                         list, or add/remove an SSH public key that may decrypt
  init                   first-time setup: add your key, create an empty store
  help                   show this help

Examples:
  secrets init
  SECRETS_SSH=root@origin.sti.care secrets pull     # adopt an existing box
  secrets set STI_ADMIN_TOKEN                       # prompts, no echo
  secrets gen-vapid                                 # rotate the push keypair
  secrets list
  SECRETS_SSH=root@origin.sti.care secrets diff
  SECRETS_SSH=root@origin.sti.care secrets sync

Config (environment variables):
  SECRETS_SSH            ssh target for sync/diff, e.g. root@origin.sti.care (required for those)
  SECRETS_IDENTITY      SSH key used to decrypt (default ~/.ssh/id_ed25519)
  SECRETS_DIR           where the encrypted store lives (default deploy/secrets)
  SECRETS_REQUIRED      keys 'sync' refuses to push without (default STI_DECOY_SECRET)
  SECRETS_REMOTE_PATH   env file on the box (default /etc/stiapi.env)
  SECRETS_REMOTE_OWNER  owner:group for the file (default root:stiapi)
  SECRETS_REMOTE_MODE   mode for the file (default 0640)
  SECRETS_SERVICE       service to restart (default stiapi)
  SECRETS_SUDO          set to "sudo" if SECRETS_SSH is a sudo user, not root

Secrets live encrypted (age) in ` + cfg.encPath() + `, readable only by the SSH keys
in ` + cfg.recipPath() + `. Plaintext never touches the repo or disk; sync streams it
over SSH on stdin. See SECRETS.md for the full story.
`)
}

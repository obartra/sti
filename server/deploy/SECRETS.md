# Server secrets

The backend reads its config from `/etc/stiapi.env` (the systemd `EnvironmentFile`):
`STI_DECOY_SECRET`, `STI_ADMIN_TOKEN`, the VAPID keys, `STI_ALLOWED_ORIGINS`, and so
on. The `secrets` tool (`server/cmd/secrets`) keeps that file encrypted in the repo
and pushes it to the box, all keyed to the SSH key you already use for the server.

## How it works

- **At rest:** `secrets/stiapi.env.age`, encrypted with [age](https://github.com/FiloSottile/age)
  to the SSH public keys in `secrets/recipients.txt`. Both are safe to commit. A
  `.gitignore` makes sure plaintext never can be.
- **To read or change:** decrypted in memory with your SSH private key (via the age
  library, so there is no `age` binary to install). `edit` uses a `0600` temp file
  that is removed on exit.
- **To deploy:** `sync` shows a key-by-key diff of what would change on the box,
  asks before pushing, then pipes the plaintext straight into `/etc/stiapi.env` over
  SSH and restarts the service. No plaintext is written to disk, here or on the box,
  and nothing secret is in the SSH command line, only on stdin. It fails closed: a
  bad key, an empty store, a missing required key, or a service that does not come
  back all stop the push or report failure.

This is intentionally separate from the CI deploy path. CI (`stiapi-deploy`) may only
ship a new binary and restart; it cannot touch secrets. Changing secrets is an admin
action over your own root SSH, which is what `sync` uses.

## Running it

From the repo root, the Makefile builds and runs it for you (no PATH setup, no
manual `go build`):

```sh
make secrets ARGS="list"                       # any subcommand via ARGS
make secrets-pull  SSH=root@origin.sti.care    # adopt the box (see below)
make secrets-diff  SSH=root@origin.sti.care
make secrets-sync  SSH=root@origin.sti.care
make secrets-edit
make gen-vapid                                 # rotate the Web Push keypair
make gen-decoy                                 # rotate the decoy secret
make gen-admin                                 # enable/rotate the admin surface
```

Or build a small binary once and call it directly (nicer for a session of edits):

```sh
cd server && go build -o /tmp/secrets ./cmd/secrets
/tmp/secrets help
```

The examples below use `secrets` for the binary; run from `server/` (or use
`make secrets ARGS="..."`) so the store under `deploy/secrets` is found.

## Adopting an existing box (first time, store empty)

The store is the whole source of truth: `sync` pushes the entire env file and
**refuses** if it is empty or missing a required key, so it cannot silently wipe the
box. To start from a box that is already configured, pull its env in first:

```sh
secrets init                                   # once: add your key, create the store
SECRETS_SSH=root@origin.sti.care secrets pull  # copy in every key the box already has
SECRETS_SSH=root@origin.sti.care secrets diff   # should now be empty (store == box)
git add server/deploy/secrets && git commit -m "chore: adopt server secrets store"
```

`pull` never overwrites a value you have already staged locally, so the usual change
is: stage your edit (e.g. `gen-vapid`), `pull` to fill in the rest, `diff` (shows
only your edit), `sync`.

## Rotating a key

```sh
secrets gen-vapid                              # new Web Push keypair, set in the store
secrets gen-decoy                              # new decoy secret, set in the store
SECRETS_SSH=root@origin.sti.care secrets diff   # confirms only those keys change
SECRETS_SSH=root@origin.sti.care secrets sync
```

Rotate either immediately if its value has leaked (e.g. pasted into a chat or a log).
`gen-decoy` does not print the value; `gen-vapid` prints only the public key.
Rotating the VAPID keypair invalidates existing push subscriptions, which
re-subscribe on the client's next visit.

## Setup (once)

```sh
secrets init                  # adds your ~/.ssh/id_ed25519.pub as a recipient
secrets set STI_DECOY_SECRET  # prompts for the value (not echoed)
# ...add the rest...
git add server/deploy/secrets && git commit -m "chore: server secrets"
```

`provision.sh` generates a starter `/etc/stiapi.env` on first provision; from then on
this tool is the source of truth.

## Everyday use

```sh
secrets list                  # key names, values masked
secrets show STI_ADMIN_TOKEN  # one value (plaintext)
secrets set KEY [VALUE]        # add or update (prompts if VALUE omitted)
secrets rm KEY                 # remove
secrets edit                   # whole file in $EDITOR, re-encrypted on save
secrets gen-vapid              # rotate the Web Push keypair (sets both keys)
secrets gen-decoy              # rotate the decoy secret
secrets gen-admin              # enable/rotate the admin surface (token + flag)
secrets diff                   # what 'sync' would change on the box
SECRETS_SSH=root@origin.sti.care secrets pull       # adopt the box's current env
SECRETS_SSH=root@origin.sti.care secrets sync       # diff, confirm, push, restart
SECRETS_SSH=root@origin.sti.care secrets sync -y    # skip the confirm
```

Add or remove an admin who may decrypt (re-encrypts to the new set):

```sh
secrets recipients add 'ssh-ed25519 AAAA... them@laptop'
secrets recipients rm them@laptop
```

## Enabling a feature

Each gated feature is one or two env keys plus a `sync`. Generate, review, push:

| Feature                | Keys                                            | One step                                | Then               |
| ---------------------- | ----------------------------------------------- | --------------------------------------- | ------------------ |
| Web Push delivery      | `STI_VAPID_PUBLIC_KEY`, `STI_VAPID_PRIVATE_KEY` | `secrets gen-vapid`                     | `diff` then `sync` |
| Decoy secret (rotate)  | `STI_DECOY_SECRET`                              | `secrets gen-decoy`                     | `diff` then `sync` |
| Admin surface (doc 20) | `STI_ADMIN_TOKEN`, `STI_ADMIN_ENABLED`          | `secrets gen-admin`                     | `diff` then `sync` |
| Public names (doc 17)  | `STI_FINDABLE_ENABLED`                          | `secrets set STI_FINDABLE_ENABLED true` | `diff` then `sync` |

For the admin surface specifically (the server refuses to boot with the flag on but
no adequate token, so `gen-admin` sets both at once):

```sh
secrets gen-admin                               # sets STI_ADMIN_TOKEN + STI_ADMIN_ENABLED=true
SECRETS_SSH=root@origin.sti.care secrets diff    # confirms only those two change
SECRETS_SSH=root@origin.sti.care secrets sync
secrets show STI_ADMIN_TOKEN                      # the bearer token, when you need to call the admin API
```

Re-running `gen-admin` rotates the token in place. The token is never printed by the
generator; read it back with `show` only when you need it.

## When sync fails

`sync` fails closed and tells you which step broke. Common cases:

- **`missing required key(s): STI_DECOY_SECRET`** -- the store does not yet have a key
  the box needs (most often because it is freshly initialized). Run `pull` to adopt
  the box's current env, then `diff` (should show only your change) and `sync`.
- **`refusing to push an empty store`** -- nothing is set yet. `init`, then `pull` or
  `set` keys.
- **a remote shell error then `sync failed (service may not be active)`** -- the write
  or restart failed on the box. Re-run `diff` to confirm the store is what you expect,
  then check the service directly:
  `ssh "$SECRETS_SSH" 'systemctl status stiapi --no-pager; journalctl -u stiapi -n 50 --no-pager'`.
  A bad value (e.g. a malformed key) shows up as the service failing to boot; fix the
  value in the store and `sync` again (the previous env file is replaced atomically,
  so a failed push never leaves a half-written file).

## Config

| Var                    | Default             | Meaning                                                 |
| ---------------------- | ------------------- | ------------------------------------------------------- |
| `SECRETS_SSH`          | (required for sync) | ssh target, e.g. `root@origin.sti.care`                 |
| `SECRETS_IDENTITY`     | `~/.ssh/id_ed25519` | SSH key used to decrypt                                 |
| `SECRETS_DIR`          | `deploy/secrets`    | where the encrypted store lives                         |
| `SECRETS_REQUIRED`     | `STI_DECOY_SECRET`  | keys `sync` refuses to push without                     |
| `SECRETS_REMOTE_PATH`  | `/etc/stiapi.env`   | env file on the box                                     |
| `SECRETS_REMOTE_OWNER` | `root:stiapi`       | owner:group for that file                               |
| `SECRETS_REMOTE_MODE`  | `0640`              | mode for that file                                      |
| `SECRETS_SERVICE`      | `stiapi`            | service to restart                                      |
| `SECRETS_SUDO`         | (empty)             | set to `sudo` if `SECRETS_SSH` is a sudo user, not root |

Use `origin.sti.care` (the DNS-only host), not the Cloudflare-proxied `api.sti.care`,
which doesn't carry SSH.

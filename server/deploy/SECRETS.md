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

From the repo root:

```sh
make secrets ARGS="list"
```

or build a small binary once and call it directly (nicer for a session of edits):

```sh
cd server && go build -o /tmp/secrets ./cmd/secrets
/tmp/secrets help
```

The examples below use `secrets` for the binary; run from `server/` (or use
`make secrets ARGS="..."`) so the store under `deploy/secrets` is found.

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
secrets diff                   # what 'sync' would change on the box
SECRETS_SSH=root@origin.sti.care secrets sync       # diff, confirm, push, restart
SECRETS_SSH=root@origin.sti.care secrets sync -y    # skip the confirm
```

Add or remove an admin who may decrypt (re-encrypts to the new set):

```sh
secrets recipients add 'ssh-ed25519 AAAA... them@laptop'
secrets recipients rm them@laptop
```

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

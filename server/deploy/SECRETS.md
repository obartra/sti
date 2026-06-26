# Server secrets

The backend reads its config from `/etc/stiapi.env` (the systemd `EnvironmentFile`):
`STI_DECOY_SECRET`, `STI_ADMIN_TOKEN`, the VAPID keys, `STI_ALLOWED_ORIGINS`, and so
on. `secrets.sh` keeps that file encrypted in the repo and pushes it to the box, all
keyed to the SSH key you already use for the server.

## How it works

- **At rest:** `secrets/stiapi.env.age`, encrypted with [age](https://github.com/FiloSottile/age)
  to the SSH public keys in `secrets/recipients.txt`. Both are safe to commit. A
  `.gitignore` makes sure plaintext never can be.
- **To read or change:** decrypted in memory with your SSH private key. `edit` uses a
  `0600` temp file that is removed on exit.
- **To deploy:** `sync` decrypts locally and pipes the plaintext straight into
  `/etc/stiapi.env` over SSH, then restarts the service. No plaintext is written to
  disk, here or on the box, and nothing secret is in the SSH command line, only on
  stdin.

This is intentionally separate from the CI deploy path. CI (`stiapi-deploy`) may only
ship a new binary and restart; it cannot touch secrets. Changing secrets is an admin
action over your own root SSH, which is what `sync` uses.

## Setup (once)

```sh
cd server/deploy
./secrets.sh init                 # adds your ~/.ssh/id_ed25519.pub as a recipient
./secrets.sh set STI_DECOY_SECRET # prompts for the value (not echoed)
# ...add the rest...
git add secrets/ && git commit -m "chore: server secrets"
```

`provision.sh` generates a starter `/etc/stiapi.env` on first provision; from then on
this tool is the source of truth.

## Everyday use

```sh
./secrets.sh list                 # key names, values masked
./secrets.sh show STI_ADMIN_TOKEN # one value (plaintext)
./secrets.sh set KEY [VALUE]      # add or update (prompts if VALUE omitted)
./secrets.sh rm KEY               # remove
./secrets.sh edit                 # whole file in $EDITOR, re-encrypted on save
SECRETS_SSH=root@origin.sti.care ./secrets.sh sync   # push + restart
```

Add another admin who may decrypt:

```sh
./secrets.sh recipients add 'ssh-ed25519 AAAA... them@laptop'   # re-encrypts to both
```

## Config

| Var                    | Default             | Meaning                                                 |
| ---------------------- | ------------------- | ------------------------------------------------------- |
| `SECRETS_SSH`          | (required for sync) | ssh target, e.g. `root@origin.sti.care`                 |
| `SECRETS_IDENTITY`     | `~/.ssh/id_ed25519` | SSH key used to decrypt                                 |
| `SECRETS_REMOTE_PATH`  | `/etc/stiapi.env`   | env file on the box                                     |
| `SECRETS_REMOTE_OWNER` | `root:stiapi`       | owner:group for that file                               |
| `SECRETS_REMOTE_MODE`  | `0640`              | mode for that file                                      |
| `SECRETS_SERVICE`      | `stiapi`            | service to restart                                      |
| `SECRETS_SUDO`         | (empty)             | set to `sudo` if `SECRETS_SSH` is a sudo user, not root |

Use `origin.sti.care` (the DNS-only host), not the Cloudflare-proxied `api.sti.care`,
which doesn't carry SSH.

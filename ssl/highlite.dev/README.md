# SSL Certificate Placement

Place your Cloudflare Origin Certificates in this directory:

## Required Files:

1. **fullchain.pem** - The certificate file
2. **privkey.pem** - The private key file

## How to get them from Cloudflare:

1. Go to Cloudflare Dashboard → SSL/TLS → Origin Certificates
2. Click "Create Certificate"
3. Copy the certificate content and save as `fullchain.pem`
4. Copy the private key content and save as `privkey.pem`

## File structure should be:
```
ssl/
└── highlite.dev/
    ├── fullchain.pem
    └── privkey.pem
```

After placing the certificates, restart nginx:
```bash
sudo podman-compose restart nginx
```

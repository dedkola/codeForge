FROM ghcr.io/coder/code-server:latest

USER root

# Install Node.js 20 + enable pnpm via corepack
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && corepack enable \
    && corepack prepare pnpm@latest --activate \
    && rm -rf /var/lib/apt/lists/*

# Scaffold an empty Next.js template at build time inside coder home
# without preinstalled dependencies (users run pnpm install themselves).
RUN npx --yes create-next-app@latest /home/coder/template \
            --ts --eslint --app --src-dir --no-tailwind --empty \
            --import-alias "@/*" --use-pnpm --skip-install --yes \
        && rm -rf /home/coder/template/node_modules /home/coder/template/.next \
    && chown -R 1000:1000 /home/coder/template

# Custom entrypoint that seeds workspace on first run
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER 1000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

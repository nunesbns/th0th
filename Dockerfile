# Usa imagem oficial do Bun mais recente
FROM oven/bun:1.3-alpine

# Instala Node.js 22.x (required by Prisma)
RUN apk add --no-cache nodejs-current

WORKDIR /app

# Copia arquivos do projeto
COPY package.json bun.lock turbo.json tsconfig.json bunfig.toml ./
COPY packages ./packages
COPY apps ./apps

# Instala dependências (ignora scripts do Prisma que checam versão do Node)
RUN bun install --ignore-scripts

# Gera Prisma Client manualmente
RUN cd packages/core && bunx prisma generate

# Build do projeto
RUN bun run build

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3333

# Expõe a porta da API
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3333/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando para iniciar a API
# Roda o arquivo TypeScript diretamente com Bun do diretório raiz do monorepo
CMD ["bun", "./apps/tools-api/src/index.ts"]

FROM node:lts

RUN npm install -g pnpm typescript
WORKDIR /app

COPY package.json ./
COPY pnpm-lock.yaml ./

RUN pnpm install

COPY . .

RUN pnpm run build

CMD ["pnpm", "run", "prod"]
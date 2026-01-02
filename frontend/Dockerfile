FROM node:18 AS build
WORKDIR /app

COPY package.json vite.config.js index.html ./
COPY src ./src

RUN npm install && npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

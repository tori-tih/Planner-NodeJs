#STAGE 1
FROM node:23.4.0
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "./index.js"]
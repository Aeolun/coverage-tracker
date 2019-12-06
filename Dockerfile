FROM node:latest

COPY . /app
WORKDIR /app

CMD npm start

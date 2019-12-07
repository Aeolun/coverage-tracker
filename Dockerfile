FROM node:latest

VOLUME /db/
ENV TYPEORM_DATABASE = /db/db.sqlite

COPY . /app
WORKDIR /app
RUN npm install

CMD npm start

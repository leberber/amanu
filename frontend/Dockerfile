FROM node as build

WORKDIR /app

COPY package*.json ./

RUN npm install

RUN npm install -g @angular/cli

COPY . .

RUN ng build --configuration=production

FROM nginx:latest

COPY --from=build app/dist/vtx-gco/browser /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf  

EXPOSE 80
# docker build --no-cache -t gco .
# docker run  -p 4200:80 --name dev gco


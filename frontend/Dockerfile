FROM nginx:alpine

# Copy the pre-built Angular app
COPY dist/Elsuq/browser /usr/share/nginx/html


EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

http-server -p 8080 -c-1 dist/amanu/browser

uvicorn main:app --host 0.0.0.0 --port 8002 --reload

 vercel .  
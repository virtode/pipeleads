FROM python:3.11-slim
RUN pip install radicale bcrypt passlib[bcrypt]
RUN mkdir -p /data/collections
COPY config /etc/radicale/config
EXPOSE 5232
CMD ["python", "-m", "radicale", "--config", "/etc/radicale/config"]

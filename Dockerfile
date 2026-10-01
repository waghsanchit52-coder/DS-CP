# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Install the g++ compiler for the C++ Engine
RUN apt-get update && apt-get install -y g++ && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy all the project files into the container
COPY . /app

# Install the Python dependencies (Flask and Gunicorn)
RUN pip install --no-cache-dir -r requirements.txt

# Compile the C++ Engine natively for Linux
RUN g++ main.cpp Graph.cpp -o RouteOptimizer_Web -O3

# Run the Python server using Gunicorn and bind to Render's dynamic port
CMD gunicorn -b 0.0.0.0:$PORT server:app

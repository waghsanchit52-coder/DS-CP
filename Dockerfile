# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Install g++ and dos2unix (to fix Windows text files)
RUN apt-get update && apt-get install -y g++ dos2unix && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy all the project files into the container
COPY . /app

# IMPORTANT: Convert Windows CSV files to Linux format to prevent C++ crashes!
RUN dos2unix *.csv

# Install the Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Compile the C++ Engine natively for Linux
RUN g++ main.cpp Graph.cpp -o RouteOptimizer_Web -O3

# Run the Python server using Gunicorn and bind to Render's dynamic port
CMD gunicorn -b 0.0.0.0:$PORT server:app

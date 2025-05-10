#!/bin/bash

# Kill any existing processes on port 9092
lsof -ti:9092 | xargs kill -9 2>/dev/null

# Run the Go server
go run main.go 
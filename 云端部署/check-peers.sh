#!/bin/bash
for port in 3000 8080 8081; do
  echo "=== port $port ==="
  ss -tn "( sport = :$port )" | tail -n +2 | awk '{print $4, "->", $5}' | sort | uniq -c | sort -rn
done

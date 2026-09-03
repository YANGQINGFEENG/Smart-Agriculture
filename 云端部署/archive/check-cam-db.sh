#!/bin/bash
mysql -uroot -pCloudMysql@2026 smart_agriculture -N -e 'SELECT id, JSON_UNQUOTE(JSON_EXTRACT(feedback, "$.stream_url")) AS stream_url, JSON_UNQUOTE(JSON_EXTRACT(feedback, "$.last_frame_url")) AS last_frame, JSON_UNQUOTE(JSON_EXTRACT(feedback, "$.found")) AS found, updated_at FROM actuators WHERE id="CAM-1-001";' 2>/dev/null

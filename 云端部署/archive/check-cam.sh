#!/bin/bash
mysql -u root -p'CloudMysql@2026' -e "
USE smart_agriculture;
SELECT id, name, state, JSON_EXTRACT(feedback, '\$.stream_url') AS stream_url,
       JSON_EXTRACT(feedback, '\$.snapshot_url') AS snapshot_url,
       JSON_EXTRACT(feedback, '\$.last_frame_url') AS last_frame_url,
       JSON_EXTRACT(feedback, '\$.last_frame_time') AS last_frame_time
FROM actuators WHERE id LIKE 'CAM%';
" 2>&1 | grep -v "Using a password"

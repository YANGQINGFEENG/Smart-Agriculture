// Simulate hardware upload to test LT-1-001 and LT-1-002
const http = require('http');

async function testUpload() {
  console.log('=== Simulate Hardware Upload ===\n');
  
  // Simulate the hardware upload JSON
  const uploadData = {
    gateway_ip: "192.168.1.100",
    gateway_type: "serial_gateway",
    mac: "11:22:33:44:55:66",
    farm_id: 1,
    area: "温室1号区域",
    nodes: [
      {
        node_id: "VL-1-001",
        type: "valve",
        state: "off",
        mode: "manual",
        location: "继电器",
        control_type: "boolean"
      },
      {
        node_id: "LT-1-001",
        type: "light",
        state: "off",
        mode: "auto",
        location: "激光",
        control_type: "boolean",
        feedback: { pin: 13 }
      },
      {
        node_id: "LT-1-002",
        type: "light",
        state: "off",
        mode: "auto",
        location: "RGB-LED",
        control_type: "integer",
        control_range: { min: 0, max: 255, step: 1, default: 0 },
        feedback: { R: 19, G: 17, B: 27 }
      }
    ]
  };
  
  console.log('Upload JSON:');
  console.log(JSON.stringify(uploadData, null, 2));
  console.log('\n--- Sending to API ---\n');
  
  try {
    const result = await sendRequest('/api/device/report', 'POST', uploadData);
    console.log('API Response:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n--- Analysis ---');
    if (result.processed_nodes) {
      for (const node of result.processed_nodes) {
        console.log(`\nNode: ${node.node_id}`);
        console.log(`  original_type: ${node.original_type}`);
        console.log(`  type: ${node.type}`);
        console.log(`  category: ${node.category}`);
        console.log(`  success: ${node.success}`);
        console.log(`  message: ${node.message}`);
        if (node.control_type) {
          console.log(`  control_type: ${node.control_type}`);
        }
      }
    }
    
    // Wait and check actuators
    await sleep(1000);
    
    console.log('\n--- Check Actuators After Upload ---');
    const actuators = await sendRequest('/api/actuators', 'GET');
    console.log(`Total actuators: ${actuators.data.length}`);
    
    for (const a of actuators.data) {
      const lastUpdate = a.last_update ? new Date(a.last_update) : null;
      const diffMin = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 60000) : null;
      console.log(`  ${a.id} | type=${a.type} | name=${a.name} | area=${a.area} | ${diffMin !== null ? diffMin + 'min ago' : 'no update'}`);
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  console.log('\n=== Done ===');
}

function sendRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

testUpload().catch(console.error);
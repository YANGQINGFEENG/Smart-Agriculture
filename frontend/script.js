// 全局变量
let sensorChart = null;
let currentChartData = {
    labels: [],
    values: [],
    sensorType: '',
    unit: ''
};

// 页面加载完成后执行
window.addEventListener('DOMContentLoaded', function() {
    // 加载设备列表
    loadDevices();
    
    // 加载实时数据
    updateData();
    
    // 设备选择事件
    document.getElementById('device-select').addEventListener('change', function() {
        const selectedDevice = this.value;
        loadSensors(selectedDevice);
    });
    
    // 更新图表按钮点击事件
    document.getElementById('update-chart').addEventListener('click', function() {
        const deviceId = document.getElementById('device-select').value;
        const sensorType = document.getElementById('sensor-select').value;
        
        if (deviceId && sensorType) {
            loadSensorData(deviceId, sensorType);
        } else {
            alert('请选择设备和传感器类型');
        }
    });
    
    // 测试图表按钮点击事件
    document.getElementById('test-chart').addEventListener('click', testChart);
    
    // 每3秒自动更新数据
    setInterval(updateData, 3000);
});

// 加载设备列表
function loadDevices() {
    fetch('http://127.0.0.1:5000/api/devices')
        .then(response => response.json())
        .then(data => {
            const deviceSelect = document.getElementById('device-select');
            const deviceGrid = document.getElementById('device-grid');
            
            // 保存当前选中的设备ID
            const selectedDeviceId = deviceSelect.value;
            
            // 清空设备选择下拉框
            deviceSelect.innerHTML = '<option value="">选择设备</option>';
            
            // 清空设备网格
            deviceGrid.innerHTML = '';
            
            // 检查数据格式
            const devices = data.success ? data.data : [];
            
            // 添加设备到下拉框和网格
            devices.forEach(device => {
                // 添加到下拉框
                const option = document.createElement('option');
                option.value = device.device_id;
                option.textContent = device.device_id;
                deviceSelect.appendChild(option);
                
                // 添加到设备网格
                const deviceCard = document.createElement('div');
                deviceCard.className = 'device-card';
                deviceCard.innerHTML = `
                    <h3>${device.device_id}</h3>
                    <p>类型: ${device.device_type}</p>
                    <p>状态: 在线</p>
                    <p>最后活跃: ${device.last_seen || '未知'}</p>
                    <span class="device-status status-online">在线</span>
                `;
                deviceGrid.appendChild(deviceCard);
            });
            
            // 恢复之前选中的设备
            deviceSelect.value = selectedDeviceId;
        })
        .catch(error => {
            console.error('加载设备列表失败:', error);
        });
}

// 加载传感器类型
function loadSensors(deviceId) {
    if (!deviceId) {
        document.getElementById('sensor-select').innerHTML = '<option value="">选择传感器</option>';
        return;
    }
    
    // 直接添加默认传感器类型，不依赖后端API
    const sensorSelect = document.getElementById('sensor-select');
    
    // 清空传感器选择下拉框
    sensorSelect.innerHTML = '<option value="">选择传感器</option>';
    
    // 模拟传感器类型数据
    const sensorTypes = [
        'temperature', 'humidity', 'illumination', 'co2', 'pressure',
        'soil_moisture', 'soil_ph', 'soil_ec', 'water_ph', 'dissolved_oxygen', 'turbidity'
    ];
    
    // 添加传感器到下拉框
    sensorTypes.forEach(sensorType => {
        const option = document.createElement('option');
        option.value = sensorType;
        option.textContent = sensorType;
        sensorSelect.appendChild(option);
    });
}

// 加载传感器数据
function loadSensorData(deviceId, sensorType) {
    fetch(`http://127.0.0.1:5000/api/sensor-data?device_id=${deviceId}&sensor_type=${sensorType}&limit=10`)
        .then(response => response.json())
        .then(data => {
            // 提取数据，只使用最新的10个数据点
            const items = data.data.slice(0, 10);
            const labels = items.map(item => item.timestamp);
            const values = items.map(item => item.value);
            
            // 确定单位
            let unit = '';
            switch(sensorType) {
                case 'temperature': unit = '°C'; break;
                case 'humidity': unit = '%'; break;
                case 'illumination': unit = 'lux'; break;
                case 'co2': unit = 'ppm'; break;
                case 'pressure': unit = 'hPa'; break;
                case 'soil_moisture': unit = '%'; break;
                case 'soil_ph': unit = 'pH'; break;
                case 'soil_ec': unit = 'mS/cm'; break;
                case 'water_ph': unit = 'pH'; break;
                case 'dissolved_oxygen': unit = 'mg/L'; break;
                case 'turbidity': unit = 'NTU'; break;
                case 'motion': unit = '状态'; break;
                case 'smoke': unit = '浓度'; break;
                case 'rain': unit = '状态'; break;
                default: unit = '';
            }
            
            // 渲染图表
            renderChart(labels, values, sensorType, unit);
        })
        .catch(error => {
            console.error('加载传感器数据失败:', error);
        });
}

// 渲染图表
function renderChart(labels, values, sensorType, unit) {
    const ctx = document.getElementById('chart').getContext('2d');
    
    // 更新当前图表数据
    currentChartData = {
        labels: labels.reverse(),
        values: values.reverse(),
        sensorType: sensorType,
        unit: unit
    };
    
    // 销毁旧图表
    if (sensorChart) {
        sensorChart.destroy();
    }
    
    // 创建新图表
    sensorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: currentChartData.labels,
            datasets: [{
                label: `${sensorType} (${unit})`,
                data: currentChartData.values,
                borderColor: '#007aff',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 3,
                pointBackgroundColor: '#007aff',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: '#007aff',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: `${sensorType} (${unit})`,
                        font: {
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                            size: 14,
                            weight: '600'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '时间',
                        font: {
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                            size: 14,
                            weight: '600'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: `${sensorType} 数据趋势`,
                    font: {
                        family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                        size: 16,
                        weight: '700'
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#007aff',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y}`;
                        }
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 10,
                        boxHeight: 10,
                        padding: 15,
                        font: {
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                            size: 12
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            animations: {
                tension: {
                    duration: 1000,
                    easing: 'linear'
                },
                x: {
                    type: 'number',
                    duration: 1000,
                    easing: 'linear'
                }
            }
        }
    });
}

// 更新图表数据（用于动态添加新数据）
function updateChartData(newData) {
    if (!sensorChart) return;
    
    // 确保数据点数量不超过10个
    if (currentChartData.labels.length >= 10) {
        // 移除最左侧的数据点
        currentChartData.labels.shift();
        currentChartData.values.shift();
    }
    
    // 添加新的数据点到右侧
    currentChartData.labels.push(newData.timestamp);
    currentChartData.values.push(newData.value);
    
    // 确保数据点数量始终为10个
    if (currentChartData.labels.length > 10) {
        currentChartData.labels = currentChartData.labels.slice(-10);
        currentChartData.values = currentChartData.values.slice(-10);
    }
    
    // 更新图表数据
    sensorChart.data.labels = currentChartData.labels;
    sensorChart.data.datasets[0].data = currentChartData.values;
    
    // 触发图表更新动画，使用平滑的过渡效果
    sensorChart.update({
        duration: 500,
        easing: 'easeInOutQuart'
    });
}

// 测试图表
function testChart() {
    const ctx = document.getElementById('chart').getContext('2d');
    
    // 销毁旧图表
    if (sensorChart) {
        sensorChart.destroy();
    }
    
    // 生成测试数据
    const labels = [];
    const datasets = [];
    
    // 生成过去24小时的时间标签
    for (let i = 0; i < 24; i++) {
        const time = new Date();
        time.setHours(time.getHours() - i);
        labels.push(time.toLocaleTimeString());
    }
    
    // 生成11个传感器的测试数据
    const sensorTypes = [
        'temperature', 'humidity', 'illumination', 'co2', 'pressure',
        'soil_moisture', 'soil_ph', 'soil_ec', 'water_ph', 'dissolved_oxygen', 'turbidity'
    ];
    
    const colors = [
        '#007aff', '#34c759', '#ff9500', '#af52de', '#5856d6',
        '#ff2d55', '#00c7be', '#ffcc00', '#34aadc', '#5856d6', '#ff9500'
    ];
    
    sensorTypes.forEach((sensorType, index) => {
        const data = [];
        for (let i = 0; i < 24; i++) {
            data.push(Math.random() * 100);
        }
        
        datasets.push({
            label: sensorType,
            data: data.reverse(),
            borderColor: colors[index],
            backgroundColor: `${colors[index]}20`,
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: colors[index],
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: colors[index],
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2
        });
    });
    
    // 创建新图表
    sensorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.reverse(),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: '测试数据值',
                        font: {
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                            size: 14,
                            weight: '600'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '时间',
                        font: {
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                            size: 14,
                            weight: '600'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: '多传感器数据趋势测试',
                    font: {
                        family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                        size: 16,
                        weight: '700'
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#007aff',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 10,
                        boxHeight: 10,
                        padding: 15,
                        font: {
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                            size: 12
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            animations: {
                tension: {
                    duration: 1000,
                    easing: 'linear'
                }
            }
        }
    });
}

// 更新数据
function updateData() {
    // 获取当前选中的设备和传感器
    const deviceId = document.getElementById('device-select').value;
    const sensorType = document.getElementById('sensor-select').value;
    
    // 构建API请求URL
    let url = 'http://127.0.0.1:5000/api/sensor-data?limit=10';
    if (deviceId && sensorType) {
        url += `&device_id=${deviceId}&sensor_type=${sensorType}`;
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            const tableBody = document.querySelector('#data-table tbody');
            
            // 清空表格
            tableBody.innerHTML = '';
            
            // 检查数据格式
            const items = data.success ? data.data : [];
            
            // 添加数据行
            items.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.device_id}</td>
                    <td>${item.sensor_type}</td>
                    <td>${item.value}</td>
                    <td>${getUnit(item.sensor_type)}</td>
                    <td>${item.timestamp}</td>
                `;
                tableBody.appendChild(row);
            });
            
            // 如果有图表且当前有选中的设备和传感器，检查是否有新数据需要更新图表
            if (sensorChart && deviceId && sensorType) {
                // 检查是否有与当前选中设备和传感器匹配的新数据
                const newData = items[0]; // 获取最新的数据点
                
                if (newData) {
                    // 检查新数据的时间戳是否比图表中最新的数据时间戳更新
                    const latestChartTimestamp = currentChartData.labels[currentChartData.labels.length - 1];
                    if (!latestChartTimestamp || newData.timestamp > latestChartTimestamp) {
                        // 更新图表数据
                        updateChartData(newData);
                    }
                }
            }
        })
        .catch(error => {
            console.error('加载实时数据失败:', error);
        });
}

// 获取单位
function getUnit(sensorType) {
    switch(sensorType) {
        case 'temperature': return '°C';
        case 'humidity': return '%';
        case 'illumination': return 'lux';
        case 'co2': return 'ppm';
        case 'pressure': return 'hPa';
        case 'soil_moisture': return '%';
        case 'soil_ph': return 'pH';
        case 'soil_ec': return 'mS/cm';
        case 'water_ph': return 'pH';
        case 'dissolved_oxygen': return 'mg/L';
        case 'turbidity': return 'NTU';
        case 'motion': return '状态';
        case 'smoke': return '浓度';
        case 'rain': return '状态';
        default: return '';
    }
}
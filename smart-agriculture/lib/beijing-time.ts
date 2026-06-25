/**
 * 北京时间工具函数
 * 解决SQLite CURRENT_TIMESTAMP返回UTC时间的问题
 */

/**
 * 获取当前北京时间的ISO字符串
 * 格式: 2026-06-25T16:38:34.000+08:00
 */
export function getBeijingTime(): string {
  const now = new Date()
  const beijingOffset = 8 * 60 * 60 * 1000 // 北京时间偏移量 (UTC+8)
  const beijingTime = new Date(now.getTime() + beijingOffset + now.getTimezoneOffset() * 60 * 1000)
  return beijingTime.toISOString().replace('Z', '+08:00')
}

/**
 * 获取当前北京时间的SQLite格式字符串
 * 格式: 2026-06-25 16:38:34
 */
export function getBeijingTimeForDB(): string {
  const now = new Date()
  const beijingOffset = 8 * 60 * 60 * 1000
  const beijingTime = new Date(now.getTime() + beijingOffset + now.getTimezoneOffset() * 60 * 1000)
  
  const year = beijingTime.getFullYear()
  const month = String(beijingTime.getMonth() + 1).padStart(2, '0')
  const day = String(beijingTime.getDate()).padStart(2, '0')
  const hours = String(beijingTime.getHours()).padStart(2, '0')
  const minutes = String(beijingTime.getMinutes()).padStart(2, '0')
  const seconds = String(beijingTime.getSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 将UTC时间转换为北京时间
 * @param utcTime UTC时间字符串或Date对象
 * @returns 北京时间字符串
 */
export function toBeijingTime(utcTime: string | Date): string {
  const date = typeof utcTime === 'string' ? new Date(utcTime) : utcTime
  const beijingOffset = 8 * 60 * 60 * 1000
  const beijingTime = new Date(date.getTime() + beijingOffset + date.getTimezoneOffset() * 60 * 1000)
  
  const year = beijingTime.getFullYear()
  const month = String(beijingTime.getMonth() + 1).padStart(2, '0')
  const day = String(beijingTime.getDate()).padStart(2, '0')
  const hours = String(beijingTime.getHours()).padStart(2, '0')
  const minutes = String(beijingTime.getMinutes()).padStart(2, '0')
  const seconds = String(beijingTime.getSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 解析数据库中的时间字符串
 * 自动处理UTC和北京时间
 */
export function parseDBTime(timeStr: string | null): Date | null {
  if (!timeStr) return null
  
  // 如果没有时区信息，假设是UTC时间（SQLite默认行为）
  if (!timeStr.includes('T') && !timeStr.includes('+') && !timeStr.includes('Z')) {
    return new Date(timeStr + 'Z') // 添加Z表示UTC
  }
  
  return new Date(timeStr)
}

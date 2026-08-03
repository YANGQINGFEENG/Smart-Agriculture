/**
 * AI 模块共享配置
 * 集中管理 AI 相关的服务地址、模型名称、上传路径等配置
 * 所有 AI 路由应从此文件获取配置，避免硬编码
 */

/** Ollama LLM 服务地址 */
export const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'

/** YOLO 推理服务地址 */
export const INFERENCE_HOST = process.env.INFERENCE_HOST || 'http://localhost:5000'

/** RAG 知识库检索服务地址 */
export const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:5001'

/** AI 默认使用的 LLM 模型（chat 和 diagnosis 共用） */
export const AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || 'qwen2.5:3b'

/** AI 聊天专用模型（可选，留空则使用 AI_DEFAULT_MODEL） */
export const AI_CHAT_MODEL = process.env.AI_CHAT_MODEL || AI_DEFAULT_MODEL

/** AI 诊断专用模型（可选，留空则使用 AI_DEFAULT_MODEL） */
export const AI_DIAGNOSIS_MODEL = process.env.AI_DIAGNOSIS_MODEL || AI_DEFAULT_MODEL

/** 推理请求超时（毫秒） */
export const AI_INFERENCE_TIMEOUT = Number(process.env.AI_INFERENCE_TIMEOUT) || 30000

/** 诊断请求超时（毫秒，需要更长时间分析多传感器数据） */
export const AI_DIAGNOSIS_TIMEOUT = Number(process.env.AI_DIAGNOSIS_TIMEOUT) || 120000

/** AI 图片上传目录（相对于项目根目录） */
export const AI_UPLOAD_DIR = process.env.AI_UPLOAD_DIR || 'public/uploads/ai'

/** AI 历史记录最大保留条数 */
export const AI_HISTORY_LIMIT = Number(process.env.AI_HISTORY_LIMIT) || 100

/** AI 聊天历史最大保留条数 */
export const AI_CHAT_HISTORY_LIMIT = Number(process.env.AI_CHAT_HISTORY_LIMIT) || 200

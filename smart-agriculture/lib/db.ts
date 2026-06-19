// 数据库连接模块 - 动态选择数据库类型
import { db as sqliteDb } from './db-sqlite';
import { db as mysqlDb } from './db-mysql';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// 根据环境变量选择数据库类型
const databaseType = process.env.DATABASE_TYPE || 'sqlite';

// 导出对应的数据库连接对象
export const db = databaseType === 'mysql' ? mysqlDb : sqliteDb;

// 导出类型
export type { RowDataPacket, ResultSetHeader };
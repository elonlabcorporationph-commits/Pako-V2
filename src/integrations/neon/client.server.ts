import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

class NeonQueryBuilder {
  private table: string;
  private queryType: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private selectCols: string = '*';
  private conditions: { column: string; operator: string; value: any }[] = [];
  private orderCol?: string;
  private orderAsc: boolean = true;
  private limitVal?: number;
  private singleResult: boolean = false;
  private maybeSingleResult: boolean = false;
  private payload: any = null;
  private upsertOptions: any = {};

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = '*') {
    this.queryType = 'select';
    this.selectCols = columns;
    return this;
  }

  insert(data: any) {
    this.queryType = 'insert';
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.queryType = 'update';
    this.payload = data;
    return this;
  }

  upsert(data: any, options?: any) {
    this.queryType = 'upsert';
    this.payload = data;
    this.upsertOptions = options || {};
    return this;
  }

  delete() {
    this.queryType = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.conditions.push({ column, operator: '=', value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAsc = options?.ascending ?? true;
    return this;
  }

  limit(val: number) {
    this.limitVal = val;
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleResult = true;
    return this;
  }

  // Make the builder thenable so it can be awaited directly
  async then(resolve: (res: { data: any; error: any }) => void, reject: (err: any) => void) {
    try {
      let queryStr = '';
      const params: any[] = [];
      let paramIndex = 1;

      if (this.queryType === 'select') {
        queryStr = `SELECT ${this.selectCols} FROM "${this.table}"`;
        if (this.conditions.length > 0) {
          const wheres = this.conditions.map(c => {
            params.push(c.value);
            return `"${c.column}" ${c.operator} $${paramIndex++}`;
          });
          queryStr += ` WHERE ${wheres.join(' AND ')}`;
        }
        if (this.orderCol) {
          queryStr += ` ORDER BY "${this.orderCol}" ${this.orderAsc ? 'ASC' : 'DESC'}`;
        }
        if (this.limitVal !== undefined) {
          queryStr += ` LIMIT ${this.limitVal}`;
        }
      } else if (this.queryType === 'insert') {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        const keys = Object.keys(rows[0]);
        const cols = keys.map(k => `"${k}"`).join(', ');
        const valueClauses = rows.map(row => {
          const placeholders = keys.map(k => {
            params.push(row[k]);
            return `$${paramIndex++}`;
          });
          return `(${placeholders.join(', ')})`;
        });
        queryStr = `INSERT INTO "${this.table}" (${cols}) VALUES ${valueClauses.join(', ')} RETURNING *`;
      } else if (this.queryType === 'update') {
        const keys = Object.keys(this.payload);
        const setClauses = keys.map(k => {
          params.push(this.payload[k]);
          return `"${k}" = $${paramIndex++}`;
        });
        queryStr = `UPDATE "${this.table}" SET ${setClauses.join(', ')}`;
        if (this.conditions.length > 0) {
          const wheres = this.conditions.map(c => {
            params.push(c.value);
            return `"${c.column}" ${c.operator} $${paramIndex++}`;
          });
          queryStr += ` WHERE ${wheres.join(' AND ')}`;
        }
        queryStr += ` RETURNING *`;
      } else if (this.queryType === 'upsert') {
        // Basic upsert handling
        const keys = Object.keys(this.payload);
        const cols = keys.map(k => `"${k}"`).join(', ');
        params.push(this.payload[keys[0]]);
        queryStr = `INSERT INTO "${this.table}" (${cols}) VALUES ($${paramIndex++}) ON CONFLICT DO NOTHING RETURNING *`;
      }

      const result = const result = await sql.query(queryStr, params);

      let data: any = result;
      if (this.singleResult || this.maybeSingleResult) {
        data = result.length > 0 ? result[0] : null;
        if (this.singleResult && !data) {
          return resolve({ data: null, error: { message: 'Row not found' } });
        }
      }

      resolve({ data, error: null });
    } catch (err) {
      resolve({ data: null, error: err });
    }
  }
}

export const neonAdmin = {
  from: (table: string) => new NeonQueryBuilder(table),
};
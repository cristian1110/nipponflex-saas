/**
 * Integración completa con Odoo ERP
 * Soporta XML-RPC y JSON-RPC
 * Funciona con TODOS los módulos instalados
 */

interface OdooConfig {
  url: string
  database: string
  username: string
  apiKey: string
}

interface OdooResponse {
  success: boolean
  data?: any
  error?: string
}

export class OdooClient {
  private config: OdooConfig
  private uid: number | null = null

  constructor(config: OdooConfig) {
    this.config = config
  }

  /**
   * Autenticación con Odoo
   */
  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.url}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            service: 'common',
            method: 'authenticate',
            args: [this.config.database, this.config.username, this.config.apiKey, {}]
          },
          id: Math.floor(Math.random() * 1000000)
        })
      })

      const result = await response.json()
      if (result.result) {
        this.uid = result.result
        return true
      }
      return false
    } catch (error) {
      console.error('Error autenticando con Odoo:', error)
      return false
    }
  }

  /**
   * Ejecutar método en cualquier modelo de Odoo
   */
  async execute(model: string, method: string, args: any[] = [], kwargs: any = {}): Promise<OdooResponse> {
    if (!this.uid) {
      const auth = await this.authenticate()
      if (!auth) return { success: false, error: 'No se pudo autenticar con Odoo' }
    }

    try {
      const response = await fetch(`${this.config.url}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            service: 'object',
            method: 'execute_kw',
            args: [
              this.config.database,
              this.uid,
              this.config.apiKey,
              model,
              method,
              args,
              kwargs
            ]
          },
          id: Math.floor(Math.random() * 1000000)
        })
      })

      const result = await response.json()
      if (result.error) {
        return { success: false, error: result.error.message || 'Error en Odoo' }
      }
      return { success: true, data: result.result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Obtener módulos instalados
   */
  async getInstalledModules(): Promise<OdooResponse> {
    return this.execute('ir.module.module', 'search_read', 
      [[['state', '=', 'installed']]], 
      { fields: ['name', 'shortdesc', 'summary'] }
    )
  }

  /**
   * Obtener todos los modelos disponibles
   */
  async getAvailableModels(): Promise<OdooResponse> {
    return this.execute('ir.model', 'search_read', 
      [[]], 
      { fields: ['model', 'name', 'modules'], limit: 500 }
    )
  }

  // ==================== CONTACTOS ====================
  
  async getContacts(domain: any[] = [], limit: number = 100): Promise<OdooResponse> {
    return this.execute('res.partner', 'search_read', 
      [domain], 
      { fields: ['name', 'email', 'phone', 'mobile', 'street', 'city', 'country_id', 'is_company', 'customer_rank', 'supplier_rank'], limit }
    )
  }

  async createContact(data: any): Promise<OdooResponse> {
    return this.execute('res.partner', 'create', [[data]])
  }

  async updateContact(id: number, data: any): Promise<OdooResponse> {
    return this.execute('res.partner', 'write', [[id], data])
  }

  // ==================== CRM ====================

  async getLeads(domain: any[] = [], limit: number = 100): Promise<OdooResponse> {
    return this.execute('crm.lead', 'search_read', 
      [domain], 
      { fields: ['name', 'partner_id', 'email_from', 'phone', 'expected_revenue', 'stage_id', 'user_id', 'probability', 'date_deadline'], limit }
    )
  }

  async createLead(data: any): Promise<OdooResponse> {
    return this.execute('crm.lead', 'create', [[data]])
  }

  async updateLead(id: number, data: any): Promise<OdooResponse> {
    return this.execute('crm.lead', 'write', [[id], data])
  }

  async getCRMStages(): Promise<OdooResponse> {
    return this.execute('crm.stage', 'search_read', [[]], { fields: ['name', 'sequence', 'is_won'] })
  }

  // ==================== VENTAS ====================

  async getSaleOrders(domain: any[] = [], limit: number = 100): Promise<OdooResponse> {
    return this.execute('sale.order', 'search_read', 
      [domain], 
      { fields: ['name', 'partner_id', 'date_order', 'state', 'amount_total', 'user_id', 'order_line'], limit }
    )
  }

  async createSaleOrder(partnerId: number, lines: any[]): Promise<OdooResponse> {
    const orderData = {
      partner_id: partnerId,
      order_line: lines.map(line => [0, 0, line])
    }
    return this.execute('sale.order', 'create', [[orderData]])
  }

  async confirmSaleOrder(orderId: number): Promise<OdooResponse> {
    return this.execute('sale.order', 'action_confirm', [[orderId]])
  }

  // ==================== FACTURACIÓN ====================

  async getInvoices(domain: any[] = [], limit: number = 100): Promise<OdooResponse> {
    return this.execute('account.move', 'search_read', 
      [[['move_type', 'in', ['out_invoice', 'out_refund']], ...domain]], 
      { fields: ['name', 'partner_id', 'invoice_date', 'state', 'amount_total', 'amount_residual', 'payment_state'], limit }
    )
  }

  async createInvoice(partnerId: number, lines: any[]): Promise<OdooResponse> {
    const invoiceData = {
      partner_id: partnerId,
      move_type: 'out_invoice',
      invoice_line_ids: lines.map(line => [0, 0, line])
    }
    return this.execute('account.move', 'create', [[invoiceData]])
  }

  async postInvoice(invoiceId: number): Promise<OdooResponse> {
    return this.execute('account.move', 'action_post', [[invoiceId]])
  }

  // ==================== INVENTARIO ====================

  async getProducts(domain: any[] = [], limit: number = 100): Promise<OdooResponse> {
    return this.execute('product.product', 'search_read', 
      [domain], 
      { fields: ['name', 'default_code', 'list_price', 'standard_price', 'qty_available', 'virtual_available', 'categ_id', 'type'], limit }
    )
  }

  async getProductStock(productId: number): Promise<OdooResponse> {
    return this.execute('stock.quant', 'search_read', 
      [[['product_id', '=', productId]]], 
      { fields: ['location_id', 'quantity', 'reserved_quantity'] }
    )
  }

  async getStockMovements(domain: any[] = [], limit: number = 100): Promise<OdooResponse> {
    return this.execute('stock.picking', 'search_read', 
      [domain], 
      { fields: ['name', 'partner_id', 'scheduled_date', 'state', 'picking_type_id', 'origin'], limit }
    )
  }

  // ==================== COMPRAS ====================

  async getPurchaseOrders(domain: any[] = [], limit: number = 100): Promise<OdooResponse> {
    return this.execute('purchase.order', 'search_read', 
      [domain], 
      { fields: ['name', 'partner_id', 'date_order', 'state', 'amount_total', 'order_line'], limit }
    )
  }

  async createPurchaseOrder(partnerId: number, lines: any[]): Promise<OdooResponse> {
    const orderData = {
      partner_id: partnerId,
      order_line: lines.map(line => [0, 0, line])
    }
    return this.execute('purchase.order', 'create', [[orderData]])
  }

  // ==================== HELPDESK ====================

  async getTickets(domain: any[] = [], limit: number = 100): Promise<OdooResponse> {
    return this.execute('helpdesk.ticket', 'search_read', 
      [domain], 
      { fields: ['name', 'partner_id', 'description', 'stage_id', 'user_id', 'priority', 'create_date'], limit }
    )
  }

  async createTicket(data: any): Promise<OdooResponse> {
    return this.execute('helpdesk.ticket', 'create', [[data]])
  }

  async updateTicket(id: number, data: any): Promise<OdooResponse> {
    return this.execute('helpdesk.ticket', 'write', [[id], data])
  }

  // ==================== CALENDARIO ====================

  async getEvents(domain: any[] = [], limit: number = 100): Promise<OdooResponse> {
    return this.execute('calendar.event', 'search_read', 
      [domain], 
      { fields: ['name', 'start', 'stop', 'partner_ids', 'description', 'location'], limit }
    )
  }

  async createEvent(data: any): Promise<OdooResponse> {
    return this.execute('calendar.event', 'create', [[data]])
  }

  // ==================== UTILIDADES ====================

  /**
   * Buscar en cualquier modelo
   */
  async search(model: string, domain: any[], fields: string[] = [], limit: number = 100): Promise<OdooResponse> {
    return this.execute(model, 'search_read', [domain], { fields, limit })
  }

  /**
   * Crear registro en cualquier modelo
   */
  async create(model: string, data: any): Promise<OdooResponse> {
    return this.execute(model, 'create', [[data]])
  }

  /**
   * Actualizar registro en cualquier modelo
   */
  async update(model: string, id: number, data: any): Promise<OdooResponse> {
    return this.execute(model, 'write', [[id], data])
  }

  /**
   * Eliminar registro en cualquier modelo
   */
  async delete(model: string, ids: number[]): Promise<OdooResponse> {
    return this.execute(model, 'unlink', [ids])
  }

  /**
   * Obtener campos de un modelo
   */
  async getFields(model: string): Promise<OdooResponse> {
    return this.execute(model, 'fields_get', [], { attributes: ['string', 'type', 'required', 'readonly'] })
  }
}

/**
 * Factory para crear cliente Odoo desde config de BD
 */
export async function createOdooClient(config: any): Promise<OdooClient | null> {
  try {
    const client = new OdooClient({
      url: config.odoo_url,
      database: config.database,
      username: config.username,
      apiKey: config.api_key
    })
    
    const authenticated = await client.authenticate()
    if (!authenticated) return null
    
    return client
  } catch (error) {
    console.error('Error creando cliente Odoo:', error)
    return null
  }
}

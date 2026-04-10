import express, { Request, Response, NextFunction } from 'express'
import { provisionTenantUser, syncTenant } from './provision'

const INTERNAL_SECRET = process.env.INTERNAL_SECRET

function requireInternalSecret(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization
  if (!INTERNAL_SECRET || auth !== `Bearer ${INTERNAL_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

export function createServer(): express.Express {
  const app = express()
  app.use(express.json())

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' })
  })

  app.post('/provision', requireInternalSecret, async (req: Request, res: Response) => {
    const { userEmail, carddavPassword, tenantSlug } = req.body as {
      userEmail: unknown
      carddavPassword: unknown
      tenantSlug: unknown
    }

    if (
      typeof userEmail !== 'string' ||
      typeof carddavPassword !== 'string' ||
      typeof tenantSlug !== 'string' ||
      !userEmail ||
      !carddavPassword ||
      !tenantSlug
    ) {
      res.status(422).json({ error: 'userEmail, carddavPassword, and tenantSlug are required' })
      return
    }

    try {
      const { server, username, path: collectionPath } = await provisionTenantUser(
        userEmail,
        carddavPassword,
        tenantSlug
      )
      res.json({
        success: true,
        server,
        username,
        path: collectionPath,
        instructions: {
          ios: {
            server: server.replace(/^https?:\/\//, ''),
            username,
            path: collectionPath,
          },
        },
      })
    } catch (err) {
      console.error('[server] provision error:', err)
      res.status(500).json({ error: 'Provisioning failed' })
    }
  })

  app.post('/sync/:tenantSlug', requireInternalSecret, async (req: Request, res: Response) => {
    const { tenantSlug } = req.params as { tenantSlug: string }

    try {
      const result = await syncTenant(tenantSlug)
      res.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      console.error(`[server] sync error for ${tenantSlug}:`, err)
      res.status(500).json({ error: message })
    }
  })

  return app
}

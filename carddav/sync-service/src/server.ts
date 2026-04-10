import express, { Request, Response, NextFunction } from 'express'
import { provisionTenantUser } from './provision'

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
      await provisionTenantUser(userEmail, carddavPassword, tenantSlug)
      res.json({
        success: true,
        path: `/${userEmail}/${tenantSlug}/addressbook/`,
      })
    } catch (err) {
      console.error('[server] provision error:', err)
      res.status(500).json({ error: 'Provisioning failed' })
    }
  })

  return app
}

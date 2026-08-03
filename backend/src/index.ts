import { createApp } from './app'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { registerPk } from './modules/pk'
import { registerChat } from './modules/chat'
import { registerStudy } from './modules/study'
import { env } from './config/env'
import { logger } from './config/logger'

const startServer = async () => {
  try {
    const app = createApp()
    const httpServer = createServer(app)

    const io = new Server(httpServer, {
      cors: {
        origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN,
        credentials: env.CORS_ORIGIN !== '*',
      },
    })
    registerPk(io)
    registerChat(io)
    registerStudy(io)

    httpServer.listen(env.PORT, () => {
      // Only show minimal startup info in development
      if (env.NODE_ENV === 'development') {
        console.log(`Server running on http://localhost:${env.PORT}${env.API_PREFIX}`)
      }
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server')
    process.exit(1)
  }
}

// Handle graceful shutdown silently
process.on('SIGTERM', async () => {
  process.exit(0)
})

process.on('SIGINT', async () => {
  process.exit(0)
})

startServer()

import { ConcreteNodes } from '@idyllic/compiler/dist/compiler/cst'
import * as http from 'http'
import { TokenType } from '@idyllic/compiler/dist/lexer'
import * as util from 'util'

export class IdyllicServer {
	constructor(public compiled: ConcreteNodes) {}

	public start(port?: number) {
		const server = http.createServer(async (req, res) => {
			try {
				res.setHeader('Content-Type', 'application/json')

				const listified = Object.entries(this.compiled.routes)

				const query: any = {}

				const routeHandler = listified
					.filter((m) => {
						const [key] = m
						const splitRoute = key.split('/').filter((z) => z !== '')
						const split = req.url
							?.split('/')
							.filter((z) => z !== '') as string[]

						let x = false
						for (const [i, z] of splitRoute.entries()) {
							if (z !== split[i]) {
								if (splitRoute[i] && splitRoute[i][0] === '{') {
									query[splitRoute[i].slice(1, splitRoute[i].length - 1)] =
										split[i]
									x = true
									continue
								}
								x = false
								break
							} else {
								x = true
							}
						}

						return x
					})
					.filter(([z]) => {
						const split = req.url
							?.split('/')
							.filter((z) => z !== '') as string[]
						console.log(split)
						console.log(z)
						return z.split('/').filter((z) => z !== '').length === split.length
					})[0]

				if (routeHandler === undefined) {
					res.writeHead(404)
					return res.end('Not found.')
				}

				const [route, handler] = routeHandler
				const requestHandler =
					handler.requests[req.method?.toLowerCase() as string]

				if (requestHandler === undefined) {
					res.writeHead(404)
					return res.end('Not found.')
				}

				const sequence = [
					...this.compiled.global,
					...handler.sequence,
					...requestHandler.sequence,
				]

				console.log(sequence)

				let request: any = req

				function runSerial(tasks: any[]) {
					let result = Promise.resolve()
					tasks.forEach((task) => {
						result = result.then(() => task())
					})
					return result
				}

				let runMore = true

				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const x = await runSerial(
					sequence.map((a) => async () => {
						if (runMore) {
							switch (a.type) {
								case TokenType.Middleware:
									const returned = await a.interop({
										...request,
										args: a.arguments,
										query,
									})

									request = returned

									return true
									break
								case TokenType.Guard:
									runMore = await a.interop({
										...request,
										args: a.arguments,
										query,
									})
									return runMore
									break
								default:
									return runMore
							}
						}
					})
				)

				if (runMore) {
					const z = await requestHandler.handler.interop({
						...request,
						args: requestHandler.handler.arguments,
						query,
					})

					res.writeHead(200)
					return res.end(JSON.stringify(z))
				} else {
					res.writeHead(500)
					return res.end('Error.')
				}
			} catch (err) {
				res.writeHead(500)
				return res.end(`Internal error: ${err}`)
			}
		})

		server.listen(port, 'localhost', () => {
			console.log('Server starteddd!')
		})
	}
}

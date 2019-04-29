#!/usr/bin/env node
const fs = require('fs')
const arguments = require('minimist')(process.argv.slice(2), {boolean: true})

//
// Get the command.
//
const positionalArguments = arguments._
const firstPositionalArgument = positionalArguments[0]
const secondPositionalArgument = positionalArguments[1]

const command = {
  isHelp: (arguments.h || arguments.help || positionalArguments.length > 2 || firstPositionalArgument === 'help'),
  isVersion: (arguments.version || arguments.v || firstPositionalArgument === 'version'),
  isGlobal: (arguments.global || firstPositionalArgument === 'global'),
  isProxy: (arguments.proxy || firstPositionalArgument === 'proxy'),
  isEnable: (arguments.enable || firstPositionalArgument === 'enable'),
  isDisable: (arguments.disable || firstPositionalArgument === 'disable'),
  isLogs: (arguments.logs || firstPositionalArgument === 'logs'),
  isStatus: (arguments.status || firstPositionalArgument === 'status'),
//isLocal: is handled below.
}

// If we didn’t match a command, we default to local.
const didMatchCommand = Object.values(command).reduce((p,n) => p || n)
command.isLocal = (arguments.local || firstPositionalArgument === 'local' || !didMatchCommand)

const firstPositionalArgumentDidMatchCommand = ['version', 'help', 'global', 'proxy', 'enable', 'disable', 'logs', 'status'].reduce((p, n) => p || (firstPositionalArgument === n), false)

const webServerArguments = firstPositionalArgumentDidMatchCommand ? arguments._.slice(1) : arguments._

//
// Populate options object.
//

const options = {
  pathToServe: pathToServe(),
  port: port()
}
Object.assign(options, proxyPaths())

//
// Execute requested command.
//

switch (true) {
  // Help
  case command.isHelp:
    require('./commands/help')
  break

  // Version
  case command.isVersion:
    require('./commands/version')
  break

  // Logs
  case command.isLogs:
    require('./commands/logs')
  break

  // Status
  case command.isStatus:
    require('./commands/status')
  break

  // Enable (start the server daemon and add it to startup items).
  case command.isEnable:
    require('./commands/enable')(options)
  break

  // Disable (stop the server daemon and remove it from startup items).
  case command.isDisable:
    require('./commands/disable')
  break

  case command.isLocal:
    require('./commands/local')(options)
  break

  case command.isGlobal:
    require('./commands/global')(options)
  break

  case command.isProxy:
    require('./commands/proxy')(options)
  break

  // Default: unsupported state; display help.
  default:
    require('./commands/help')
  break
}


//
// Helpers
//

// Return the path to serve (for server commands) or exit the app if it doesn’t exist.
function pathToServe () {
  const isServerCommand = command.isLocal || command.isGlobal || command.isEnable

  // Only relevant for server commands.
  if (!isServerCommand) {
    return null
  }

  // If no path is passed, we serve the current folder.
  // If there is a path, we’ll serve that.
  let pathToServe = '.'

  if (webServerArguments.length === 1) {
    // e.g., web-server enable path-to-serve OR web-server --enable path-to-serve
    pathToServe = webServerArguments[0]
  }

  // Ensure the path actually exists.
  if (!fs.existsSync(pathToServe)) {
    console.error(`\n 🤔 Error: could not find path ${pathToServe}\n`)
    process.exit(1)
  }

  return pathToServe
}


// Return the requested port or exit the app if it is invalid.
function port () {
  // If a port is specified, use it. Otherwise use the default port (443).
  let port = 443
  if (arguments.port !== undefined) {
    port = parseInt(arguments.port)
  }

  // Check for a valid port range
  // (port above 49,151 are ephemeral ports. See https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers#Dynamic,_private_or_ephemeral_ports)
  if (port < 0 || port > 49151) {
    console.error('\n 🤯 Error: specified port must be between 0 and 49,151 inclusive.\n')
    process.exit(1)
  }

  return port
}


// If the server type is proxy, return the proxy URL (and exit with an error if one is not provided).
function proxyPaths () {
  const proxyPaths = {httpProxyPath: null, webSocketProxyPath: null}

  if (command.isProxy) {
    if (webServerArguments.length !== 1) {
      // A proxy path must be included.
      console.log('\n 🤯  Error: you must supply a URL to proxy. e.g., web-server proxy http://localhost:1313\n')
      process.exit(1)
    }
    proxyPaths.httpProxyPath = webServerArguments[0]

    if (proxyPaths.httpProxyPath.startsWith('https://')) {
      // Cannot proxy HTTPS.
      console.log('\n 🤯  Error: cannot proxy HTTPS.\n')
      process.exit(1)
    }

    if (!proxyPaths.httpProxyPath.startsWith('http://')) {
      proxyPaths.httpProxyPath = `http://${proxyPaths.httpProxyPath}`
    }

    proxyPaths.webSocketProxyPath = proxyPaths.httpProxyPath.replace('http://', 'ws://')
  }

  return proxyPaths
}

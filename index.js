const cheerio = require('cheerio')

class ZWJSBridgeReadyPlugin {
	ignore = []
	loading = false
	serviceCode = ''
	path = '\\'

	constructor(params = {}) {
		this.ignore = params.ignore || []
		this.loading = params.loading || false
		this.serviceCode = params.serviceCode || ''
		this.path = params.path || '\\'
	}

	apply(compiler) {
		compiler.hooks.emit.tapAsync('ZWJSBridgeReadyPlugin', (compilation, callback) => {
			const assets = compilation.assets
			const keys = Object.keys(assets)
			keys.forEach(key => {
				const content = assets[key].source()
				if (key.endsWith('.html')) {
					const scripts = []
					const $ = cheerio.load(content)
					$('script')
						.filter((i, val) => {
							const isTarget = /^\.\/(.*?)\.js$/.test(val.attribs.src)
							if (isTarget && !this.ignore.includes(val.attribs.src)) {
								scripts.push(val.attribs.src)
								return true
							}
						})
						.remove()
					$('head').append(this.zwScript(JSON.stringify(scripts)))
					const result = $.html()
					assets[key] = {
						source: () => result,
						size: () => result.length,
					}
				}
			})
			callback()
		})
	}

	zwScript = scripts => `
<script>
(function(){
	${this.serviceCode && this.toTicket()}
	var sUserAgent = window.navigator.userAgent.toLowerCase()
	var isAlipay = sUserAgent.indexOf('miniprogram') > -1 && sUserAgent.indexOf('alipay') > -1
	const loadScripts = () => {
		${scripts}.forEach(v => {
			const script = document.createElement('script')
			script.type = 'text/javascript'
			script.src = v
			script.defer = true
			document.getElementsByTagName('head')[0].appendChild(script)
		}) 
	}
	if(isAlipay) {
		${this.loading ? `ZWJSBridge.showPreloader()` : ''}
		ZWJSBridge.onReady(() => {
			console.log('zwjs ready')   
			loadScripts()
			${this.loading ? `ZWJSBridge.hidePreloader()` : ''}
		}) 
	} else {
		loadScripts()
		ZWJSBridge.onReady(() => {
			console.log('zwjs ready') 
		}) 
	}
})()
</script>
`

	toTicket() {
		return ` 
var ua = window.navigator.userAgent.toLowerCase()
var isAlipay =  ua.indexOf('miniprogram') > -1 && ua.indexOf('alipay') > -1
var isWechat = ua.toLowerCase().indexOf('micromessenger') > -1
var ticket = location.toString().match(/ticket=(.*?-ticket)/)?.[1]
if(ticket || isWechat) return 
const { origin, pathname } = location
let params = \`servicecode=${this.serviceCode}&redirectUrl=\${encodeURIComponent(
	origin + pathname + '${this.path}',
)}\`
if (location.href.includes('debug=true')) params += '?debug=true'
let replaceLocation = \`https://puser.zjzwfw.gov.cn/sso/alipay.do?action=ssoLogin&\` + params
if (!isAlipay) {
	replaceLocation = \`https://puser.zjzwfw.gov.cn/sso/mobile.do?action=oauth&scope=1&\` + params
}
location.replace(replaceLocation)
		`
	}
}

module.exports = ZWJSBridgeReadyPlugin

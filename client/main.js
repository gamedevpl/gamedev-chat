define("Chat", ["dojo/cookie", "dojo/window", "dojo/NodeList-traverse"], function(cookie) {
	function align10(v) {
		v = parseInt(v);
		if (!v)
			return '00'
		else if (v >= 10)
			return v;
		else
			return '0' + v;
	}
	
	return function Chat() {
		this.node = dojo.create('div', {
			className : 'chat'
		}, dojo.body(), 'last');
		this["shrink"] = function() {
			if (!this.scrollBlock)
				while (chat.msgCount > 1000) {
					chat.msgNode.removeChild(chat.msgNode.firstChild);
					chat.msgCount--;
				}
			chat.msgNode.style.maxHeight = dojo.window.getBox().h - 85 + 'px';

			if (!this.scrollBlock)
				chat.msgNode.scrollTop = chat.msgNode.scrollHeight;
		};
		this["show"] = function() {
			dojo.publish('/gamedev/chat-open');
			dojo.toggleClass(this.node, 'chat-show', true);
			this.shrink();
			chat.unreadCount = 0;
			dojo.byId('chat-uread').innerHTML = '';
			if (chat.lastID > '-0000000000000')
				dojo.cookie('lastChatID', chat.lastID, {
					path : '/',
					expires : 7
				})
			dojo.query('.input', chat.node).forEach(function(input) {
				input.focus()
			});
		};
		this["unreadCount"] = 0;

		this["submitQ"] = [];
		this["submitNode"] = [];

		this["submit"] = function(form) {
			var input = dojo.query('.input', form)[0];
			if (input.innerHTML.length == 0)
				return;

			if (input.innerHTML.length > 2048)
				input.innerHTML = input.innerHTML.substring(0, 2048);
			var dt = new Date();
			var node = dojo.create('li', {
				className : 'chli snt',
				innerHTML : '<span class="ts">[' + align10(dt.getHours()) + ':' + align10(dt.getMinutes()) + ':' + align10(dt.getSeconds()) + ']</span><strong>' + chat.name + '</strong>'
						+ '<span class="ln">' + chat.parsers.parse(input.innerHTML.replace(/&nbsp;/g, ' ').replace(/<br>/g, '\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')) + '</span><div class="clb"></div>'
			}, chat.msgNode, 'last');
			this.scrollBlock = false;
			this.shrink();
			chat.submitQ.push('chat-send_' + input.innerHTML);
			chat.submitNode.push(node);
			chat.msgCount++;
			input.innerHTML = '';
			if (chat.updateTimeout) {
				clearTimeout(chat.updateTimeout);
				chat.update();
			}
		};

		this["msgCount"] = 0;
		this["lastID"] = '-0000000000000';
		this["memberClick"] = function() {
			var input = dojo.query('form .input', chat.node)[0];
			var name = dojo.query('b', this)[0].innerHTML;
			if (input && input.value.indexOf('@' + name + ' ') == -1)
				input.value = '@' + name + ' ' + input.value;
			input.focus();
			(function() {
				if (typeof input.selectionStart == "number") {
					input.selectionStart = input.selectionEnd = input.value.length;
				} else if (typeof input.createTextRange != "undefined") {
					input.focus();
					var range = input.createTextRange();
					range.collapse(false);
					range.select();
				}
			}).later(0)();
		};
		this["specials"] = {
			'typing' : function(el) {
				var name = dojo.query('strong', el)[0].innerHTML;
				var node = chat.membersHash[name];
				if (node) {
					dojo.toggleClass(node, 'typing', true);
					if (node.timeout) {
						clearTimeout(node.timeout)
						clearInterval(node.interval);
					}
					node.interval = setInterval(function() {
						dojo.toggleClass(node, 'pulse');
					}, 500)
					node.timeout = setTimeout(function() {
						dojo.toggleClass(node, 'typing', false);
						clearInterval(node.interval);
						node.interval = node.timeout = null;
					}, 5000)
				}
			},
			'afk-true' : function(el) {
				var name = dojo.query('strong', el)[0].innerHTML;
				if (chat.membersHash[name])
					dojo.toggleClass(chat.membersHash[name], 'afk', true);
				return null;
			},
			'afk-false' : function(el) {
				var name = dojo.query('strong', el)[0].innerHTML;
				if (chat.membersHash[name])
					dojo.toggleClass(chat.membersHash[name], 'afk', false);
				return null;
			},
			'join' : function(el) {
				var name = dojo.query('strong', el)[0].innerHTML;
				var alias = name.substring(0, name.indexOf(' '));
				name = name.substring(name.indexOf(' ') + 1, name.length);
				if (!chat.membersHash[name] && !(dojo.query('.u_' + alias, chat.membersNode)[0])) {
					chat.membersHash[name] = dojo.create('li', {
						innerHTML : '<span class="avatar query user-avatar_' + alias + '"></span> <b>' + name + '</b>',
						onclick : chat.memberClick,
						className : 'u_' + alias
					}, chat.membersNode, 'first')
					return ' <i>' + name + ' dołącza do czatu.</i>';
				}
			},
			'leave' : function(el) {
				var name = dojo.query('strong', el)[0].innerHTML;
				var alias = name.substring(0, name.indexOf(' '));
				name = name.substring(name.indexOf(' ') + 1, name.length);
				if (chat.membersHash[name] && (dojo.query('.u_' + alias, chat.membersNode)[0])) {
					chat.membersNode.removeChild(chat.membersHash[name]);
					chat.membersHash[name] = null;
					return ' <i>' + name + ' opuszcza czat.</i>';
				}
			}
		};

		this["close"] = function() {
			dojo.publish('/gamedev/chat-close');
			dojo.toggleClass(chat.node, 'chat-show', false);
			dojo.toggleClass(chat.node, 'chat-full-screen', false);
		};

		this["onLinkClick"] = function(e) {
			if (dojo.mouseButtons.isLeft(e) && !(e.button.shiftKey || e.button.ctrlKey || e.button.altKey || e.button.metaKey))
				e.preventDefault();
		};

		(this["parsers"] = [
		// @me:
		new (function() {
			var me = dojo.query('div.login a[href="/konto"]')[0];
			if (me)
				this.pattern = new RegExp('^@?' + me.innerHTML.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1") + '(.*)', 'gi');
			this.func = function(content) {
				if (!this.pattern)
					return content;
				var m = this.pattern.exec(content);
				if (m)
					return '<b onmouseover="this.style.fontWeight=\'normal\';">' + content + '</b>';
				return content;
			}
		}),
		// @user,
		// new (function() {
		// this.pattern = new RegExp('^@([^\s^"]+)', 'gi');
		// this.func = function(content) {
		// if (!this.pattern)
		// return content;
		// var m;
		// var users = {}
		// while(m = this.pattern.exec(content))
		// users[m[0]] = true;
		// for ( var user in users)
		// content = content.split(user).join('<a target="_blank" href="' + user
		// + '"
		// onclick="return false">' + user + '</a>');
		// return content;
		// }
		// }),
		// @linebreak,
		new (function() {
			this.func = function(content) {
				return content.replace(/^[\n]{1,}/gi, '').replace(/[\n]{1,}$/gi, '').replace(/[\n]{1,}/gi, '<br/>');
			}
		}),
		// url:
		new (function() {
			this.pattern = /(\b(https?|ftp|file):\/\/[\-A-Z0-9+&@#\/%?=~_|!:,.;]*[\-A-Z0-9+&@#\/%=~_|])/ig;
			this.func = function(content) {
				// this.pattern.reset();
				var m;
				var urls = {};
				while (m = this.pattern.exec(content))
					urls[m[0]] = true;
				for ( var url in urls)
					content = content.split(url).join('<a target="_blank" href="' + url + '" onclick="chat.onLinkClick(window.event)">' + url + '</a>');
				return content;
			};
		})]).parse = function(content) {
			for ( var i = 0; i < this.length; i++)
				content = this[i].func.call(this[i], content);
			return content;
		};

		this["sendQ"] = function() {
			var nodes = this.submitNode.splice(0, this.submitNode.length);
			var queries = this.submitQ.splice(0, this.submitQ.length);
			nodes.push(null);
			queries.push('chat-fetch_' + (chat.lastID)) + '--' + (new Date().getTime() - chat.lastType < 5000) + '--' + (window._focused === true && dojo.hasClass(chat.node, 'chat-show'));
			dojo.xhrPost({
				url : '/cmd-query',
				nodes : nodes,
				content : {
					query : queries,
					wait : true
				},
				load : function(a) {
					var result = _eval(a);
					for ( var i = 0; i < result.length - 1; i++) {
						this.node = this.nodes[i];
						result[i].value = result[i].value.split(' ');
						var ts = parseInt(result[i].value[0]);
						var id = result[i].value[1];
						// if (dojo.query(ts, chat.msgNode)[0]) {
						// // chat.msgNode.removeChild(this.node)
						// //console.log('skip');
						// continue;
						// }
						var dt = new Date();
						dt.setTime(ts);
						dojo.query('span.ts', this.node)[0].innerHTML = '[' + align10(dt.getHours()) + ':' + align10(dt.getMinutes()) + ':' + align10(dt.getSeconds()) + ']';
						dojo.cookie('lastChatID', (chat.lastID = chat.lastID > id ? chat.lastID : id), {
							path : '/',
							expires : 7
						})
						this.node.id = id;
						dojo.toggleClass(this.node, ts + '');
					}
					chat.parseQuery(result[result.length - 1]);
				},
				error : function() {
					var params = this;
					if (params.errors++ > 20)
						return;
					chat.updateTimeout = setTimeout(function() {
						chat.updateTimeout = null;
						dojo.xhrPost(params);
					}, 1000);
				}// ,
			});
		};

		this.parseQuery = function(a, single) {

			var liqr = a ? dojo.query('li', dojo.create('div', {
				innerHTML : a.value
			})) : [];
			if (liqr.length > 1000)
				liqr.splice(0, liqr.length - 1000);
			if (liqr.length > 0) {
				var cookieTS = dojo.cookie('lastChatID') ? dojo.cookie('lastChatID') : null;

				liqr.forEach(function(el) {
					var special = el.className.indexOf('special') >= 0;
					if (special) {
						dojo.toggleClass(el, 'special');
						dojo.toggleClass(el, '-special');
					}

					if (cookieTS != null && el.id > cookieTS || !cookieTS)
						chat.unreadCount++;
					chat.lastID = chat.lastTS > el.id ? chat.lastTS : el.id;

					if (dojo.byId(el.id)) {
						chat.placeNode(dojo.byId(el.id));
						return;
					}

					try {
						dojo.query('span.ln', el).forEach(function(ln) {
							ln.innerHTML = chat.parsers.parse(ln.innerHTML);
						});
					} catch (e) {

					}

					chat.placeNode(el);

					var dt = new Date();
					dt.setTime(parseInt(el.className));

					if (special && chat.specials[dojo.query('p', el)[0].innerHTML]) {
						var special = chat.specials[dojo.query('p', el)[0].innerHTML](el);
						if (!special) {
							chat.unreadCount--;
							return el.parentNode.removeChild(el);
						}
						el.innerHTML = special;
					}

					dojo.create('span', {
						className : 'ts',
						innerHTML : '[' + align10(dt.getHours()) + ':' + align10(dt.getMinutes()) + ':' + align10(dt.getSeconds()) + ']'
					}, el, 'first');

					dojo.toggleClass(el, 'chli');
					chat.msgCount++;
				})

				loadRefs('query');

				if (dojo.hasClass(chat.node, 'chat-show'))
					dojo.cookie('lastChatID', chat.lastID, {
						path : '/',
						expires : 7
					})

				this.shrink();

				dojo.style(chat.msgNode)
				// chat.node.innerHTML = ;
				if (!single)
					chat.updateTimeout = setTimeout(function() {
						chat.updateTimeout = null;
						chat.update()
					}, window._focused && (dojo.hasClass(chat.node, 'chat-show')) ? 500 : 8000);
			} else if (!single)
				chat.updateTimeout = setTimeout(function() {
					chat.updateTimeout = null;
					chat.update()
				}, window._focused && (dojo.hasClass(chat.node, 'chat-show')) ? 1000 : 10000);

			var visible = dojo.hasClass(chat.node, 'chat-show');
			if (chat.unreadCount > 0 && (!window._focused || !visible)) {
				if (!visible)
					dojo.byId('chat-uread').innerHTML = '+' + chat.unreadCount;
				if (!document._title)
					document._title = document.title;
				if (!window._focused)
					document.title = '(' + chat.unreadCount + ') ' + document._title;
			} else {
				if (document._title)
					document.title = document._title;
				chat.unreadCount = 0;
				dojo.byId('chat-uread').innerHTML = '';
			}
		}

		this["update"] = function() {
			if (this.submitQ.length > 0) {
				this.sendQ();
				return;
			}

			loadQueries(['@chat-fetch_' + chat.lastID + '--' + (new Date().getTime() - chat.lastType < 1500) + '--' + (window._focused === true && dojo.hasClass(chat.node, 'chat-show'))], [{
				_onquery : function(a) {
					chat.parseQuery(a);
				}
			}]);

			// dojo.xhrPost({
			// errors : 0,
			// url : '/cmd-query',
			// content : {
			// query : ,
			// wait : true
			// },
			// error : function() {
			// var params = this;
			// if (params.errors++ > 20)
			// return;
			// chat.updateTimeout = setTimeout(function() {
			// chat.updateTimeout = null;
			// dojo.xhrPost(params);
			// }, 1000);
			// },
			// load : function(a) {
			// chat.parseQuery(_eval(a)[0]);
			// }
			// })
		};

		dojo.connect('onresize', this.node, function() {
			if (chat.resizeTimeout)
				clearTimeout(chat.resizeTimeout);
			chat.resizeTimeout = setTimeout(function() {
				chat.shrink();
				chat.resizeTimeout = null;
			}, 100);
		});

		this.node._onquery = function() {
			dojo.query('.input', this).connect("onkeydown", function(event) {
				if (event.keyCode == 27)
					chat.close();
				if (event.keyCode == 13 && !event.shiftKey) {
					event.preventDefault();
					dojo.query(this).parents('form')[0].onsubmit()
				}
				chat.lastType = new Date().getTime();
				window._focused = true;
			});
			try {
				chat.name = dojo.query('strong.name', this)[0].innerHTML;
			} catch (e) {

			}
			chat.msgNode = dojo.query('ul.chat-msg', this)[0];
			dojo.connect(chat.msgNode, "onscroll", chat, function() {
				this.scrollBlock = !(this.msgNode.scrollTop + this.msgNode.offsetHeight >= chat.msgNode.scrollHeight);
			})
			chat.membersNode = dojo.query('.chat-members', this)[0];
			chat.membersHash = {};
			dojo.query('li', chat.membersNode).forEach(function(el) {
				chat.membersHash[dojo.query('b', el)[0].innerHTML] = el;
			})

			var subscription;
			subscription = dojo.subscribe('/gamedev/chat-open', function() {
				loadQueries(['chat-ping'], [{}]);
				dojo.cookie('/gamedev/chat-open', true);
				dojo.unsubscribe(subscription);
				chat.updateTimeout = setTimeout(function() {
					chat.updateTimeout = null;
					chat.update()
				}, 1000);
			});
			if (dojo.cookie('/gamedev/chat-open') == 'true')
				dojo.publish('/gamedev/chat-open');
		}
		this["placeNode"] = function(el) {
			var ref = chat.msgNode.lastChild;
			if (!ref || ref.id < el.id)
				dojo.place(el, chat.msgNode, 'last');
			else if (el.followingSibling && (ref = el.followingSibling).id < el.id) {
				while (ref.nextSibling && ref.id > el.id)
					ref = ref.nextSibling;
				dojo.place(el, chat.msgNode, ref, 'before');
			} else {
				while (ref.previousSibling && ref.id > el.id)
					ref = ref.previousSibling;
				dojo.place(el, chat.msgNode, ref, 'after');
			}
		}

		loadQueries(['chat-init'], [this.node]);
	}
});

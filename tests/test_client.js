window["queryAdapters"] = new (function() {

	this["execute"] = function(command, params, query, node) {
		if (!this.commands[command])
			return false;

		this.commands[command](params, query, node);

		return true;
	}

	this["commands"] = {};

	this.commands["chat-init"] = function(params, query, node) {
		dojo.xhrGet({
			url : 'chat_template.html'
		}).then(function(r) {
			r = {
				value : r
			};

			if (node._onbeforequery)
				node._onbeforequery(r);
			if (r.value) {
				node.innerHTML = r.value;
			}
			if (node._onquery)
				node._onquery(r);
		})
	}

});

window["loadQueries"] = function(queries, elements) {
	queries.every(function(query, i) {
		var node = elements[i];
		
		// synchronous queries
		if(query.indexOf('@') == 0)
			query = query.substring(1);
		
		var command = query.split('_')[0];
		var params = query.substring(command.length);

		if (!queryAdapters.execute(command, params, query, node))
			console.log('Unsupported query: ', query);

		return true;
	})
}

require(['Chat'], function(Chat) {
	window["chat"] = new Chat();
});
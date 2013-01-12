window["loadQueries"] = function(queries, elements) {
	queries.every(function(query) {
		console.log('Unsupported query: ', query);

		return true;
	})
}

require(['../client/main.js'], function(Chat) {
	window["chat"] = new Chat();
});
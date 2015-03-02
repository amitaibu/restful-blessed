var blessed = require('blessed')
  , contrib = require('./index')
  , inquirer = require('inquirer')
  , request = require('request')
  , R = require('ramda')
  , Q = require('q')
  , moment = require('moment');

var companyIds;

var questions = [
  {
    type: "input",
    name: "url",
    message: "The URL",
    default: 'http://localhost/skeleton/www'
  },
  {
    type: "input",
    name: "username",
    message: "Username",
    default: 'demo'
  },
  {
    type: "input",
    name: "password",
    message: "Password",
    default: '1234'
  },
  {
    type: "list",
    name: "company",
    message: "Which company to show",
    choices: function getCompany(answers) {
      // Declare function as asynchronous, and save the done callback
      var done = this.async();

      var url = answers.url + '/api/companies';

      var auth = {
        user: answers.username,
        password: answers.password,
        sendImmediately: true
      };

      request.get(url, {auth: auth}, function (error, response, body) {
        var data = JSON.parse(body).data;

        companyIds = data;

        var result = R.map(R.prop('label'), data);
        done(result);
      });
    },
    filter: function filterCompany(answer) {
      // Return the company ID.
      var result = R.find(R.propEq('label', answer))(companyIds);
      return (R.prop('id', result));
    }
  }
];

inquirer.prompt( questions, function(answers) {
  getEvents(answers).then(function (events) {
    renderScreen(events, answers);
  });
});

/**
 * Get events from the server.
 *
 * @param answers
 */
getEvents = function(answers) {
  var defer = Q.defer();
  var url = answers.url + '/api/events';

  var qs = {
    filter: {
      company: answers.company
    }
  };

  var auth = {
    user: answers.username,
    password: answers.password,
    sendImmediately: true
  };

  request.get({uri: url, qs: qs, auth: auth}, function (error, response, body) {
    defer.resolve(JSON.parse(body).data);
  });

  return defer.promise;
};

function renderScreen(events, answers) {
  var screen = blessed.screen();

  // Register the escape early, so if there's an error in the code, it's
  // possible to exit the process.
  screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
  });

  // Create layout and widgets.
  var grid = new contrib.grid({rows: 1, cols: 2})

  var grid1 = new contrib.grid({rows: 1, cols: 1})
  grid1.set(0, 0, 1, 1, contrib.log,
    { fg: "green"
      , selectedFg: "green"
      , label: 'Server Log'});

  var grid3 = new contrib.grid({rows: 1, cols: 1})
  grid3.set(0, 0, 1, 1, contrib.table,
    { keys: true
      , fg: 'green'
      , label: 'Events'
      , columnSpacing: [24, 10, 10]})

  var grid4 = new contrib.grid({rows: 2, cols: 1})
  grid4.set(0, 0, 1, 1, grid3);
  grid4.set(1, 0, 1, 1, grid1);

  var grid5 = new contrib.grid({rows: 2, cols: 1})

  grid5.set(0, 0, 1, 1, contrib.map, {label: 'Map'})
  grid5.set(1, 0, 1, 1, contrib.line,
    { maxY: 500,
      label: 'Request time (ms)'
    });

  grid.set(0, 0, 1, 1, grid5)
  grid.set(0, 1, 1, 1, grid4)

  grid.applyLayout(screen)

  var map = grid5.get(0, 0);
  var transactionsLine = grid5.get(1, 0);
  var log = grid1.get(0, 0);
  var table = grid3.get(0,0);

  var commands = ['grep', 'node', 'java', 'timer', '~/ls -l', 'netns', 'watchdog', 'gulp', 'tar -xvf', 'awk', 'npm install']

//set dummy data for table
  function generateTable() {
    var data = []

    for (var i=0; i<30; i++) {
      var row = []
      row.push(commands[Math.round(Math.random()*(commands.length-1))])
      row.push(Math.round(Math.random()*5))
      row.push(Math.round(Math.random()*100))

      data.push(row)
    }

    table.setData({headers: ['Title', 'Author', 'Time'], data: data})
  }

  generateTable()
  table.focus()
  setInterval(generateTable, 3000)


  // Set log data.
  log.log('Starting process');
  screen.render();

  /**
   * Set the response time from the server.
   *
   * @param value
   */
  function setResponseTime(value) {
    log.log('Request time ' + value + 'ms');
    screen.render();
  }


  // Set map markers.
  var marker = true;
  setInterval(function() {
    if (marker) {

      /**
       * Transform lat lng values to the one expected.
       *
       * @param obj
       *
       * @returns {{lon: string, lat: string}}
       */
      var transformLatLng = function(obj) {
        return {
          lon: obj.lng,
          lat: obj.lat
        };
      };

      /**
       * Wrapper function to add a marker to the map.
       *
       * @param obj
       *   Object with "lon" and "lat".
       */
      var addMarker = function(obj) {
        map.addMarker(obj);
      };

      var addMarkers = R.compose(addMarker, transformLatLng, R.prop('location'));
      R.mapObj(addMarkers, events);
    }
    else {
      map.clearMarkers()
    }
    marker =! marker
    screen.render()
  }, 1000)




  // Set line charts data.
  var transactionsData = {
    x: [],
    y: []
  }

  for (var i = 10; i > 1; i--) {
    transactionsData.x.push(moment().subtract(i, 'seconds').format('hh:mm:ss'));
    transactionsData.y.push(0);
  }

  setLineData(transactionsData, transactionsLine)

  function setLineData(data, line, value) {
    // Add the new value.
    data.y.shift();
    data.y.push(value)

    // Change the time of the last item.
    data.x.shift();
    data.x.push(moment().format('hh:mm:ss'));

    line.setData(data.x, data.y)
  }

  screen.render();

  setInterval(function() {
    // Keep queries the server.
    var start = new Date();
    getEvents(answers).then(function (response) {
      events = response;
      var responseTime = new Date() - start;

      // Set linedata.
      setLineData(transactionsData, transactionsLine, responseTime);
      setResponseTime(responseTime);

    });
  }, 1000);
}

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

  //create layout and widgets
  var grid = new contrib.grid({rows: 1, cols: 2})

  var grid1 = new contrib.grid({rows: 1, cols: 3})
  grid1.set(0, 0, 1, 1, contrib.log,
    { fg: "green"
      , selectedFg: "green"
      , label: 'Server Log'})
  grid1.set(0, 1, 1, 1, contrib.line,
    { style:
    { line: "yellow"
      , text: "green"
      , baseline: "black"}
      , xLabelPadding: 3
      , xPadding: 5
      , label: 'Network Latency (sec)'})

  var grid2 = new contrib.grid({rows: 2, cols: 1})
  grid2.set(0, 0, 1, 1, contrib.gauge, {label: 'Deployment Progress'})
  grid2.set(1, 0, 1, 1, contrib.sparkline,
    { label: 'Throughput (bits/sec)'
      , tags: true
      , style: { fg: 'blue' }})

  grid1.set(0, 2, 1, 1, grid2)

  var grid3 = new contrib.grid({rows: 1, cols: 2})
  grid3.set(0, 0, 1, 1, contrib.bar,
    { label: 'Server Utilization (%)'
      , barWidth: 4
      , barSpacing: 6
      , xOffset: 2
      , maxHeight: 9})
  grid3.set(0, 1, 1, 1, contrib.table,
    { keys: true
      , fg: 'green'
      , label: 'Active Processes'
      , columnSpacing: [24, 10, 10]})

  var grid4 = new contrib.grid({rows: 3, cols: 1})
  grid4.set(0, 0, 1, 1, contrib.line,
    { style:
    { line: "red"
      , text: "white"
      , baseline: "black"}
      , label: 'Errors Rate'
      , maxY: 60})
  grid4.set(1, 0, 1, 1, grid3)
  grid4.set(2, 0, 1, 1, grid1)

  var grid5 = new contrib.grid({rows: 2, cols: 1})
  grid5.set(0, 0, 1, 1, contrib.line,
    { maxY: 500,
      label: 'Total Transactions'
    });

  grid5.set(1, 0, 1, 1, contrib.map, {label: 'Servers Location'})
  grid.set(0, 0, 1, 1, grid5)
  grid.set(0, 1, 1, 1, grid4)

  grid.applyLayout(screen)

  var transactionsLine = grid5.get(0, 0)
  var errorsLine = grid4.get(0, 0)
  var latencyLine = grid1.get(0, 1)
  var map = grid5.get(1, 0)
  var log = grid1.get(0, 0)
  var table = grid3.get(0,1)
  var sparkline = grid2.get(1, 0)
  var gauge = grid2.get(0, 0)
  var bar = grid3.get(0, 0)


//dummy data
  var servers = ['US1', 'US2', 'EU1', 'AU1', 'AS1', 'JP1']
  var commands = ['grep', 'node', 'java', 'timer', '~/ls -l', 'netns', 'watchdog', 'gulp', 'tar -xvf', 'awk', 'npm install']


//set dummy data on gauge
  var gauge_percent = 0
  setInterval(function() {
    gauge.setPercent(gauge_percent++)
    if (gauge_percent>100) gauge_percent = 0
  }, 200)


//set dummy data on bar chart
  function fillBar() {
    var arr = []
    for (var i=0; i<servers.length; i++) {
      arr.push(Math.round(Math.random()*10))
    }
    bar.setData({titles: servers, data: arr})
  }
  fillBar()
  setInterval(fillBar, 2000)


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

    table.setData({headers: ['Process', 'Cpu (%)', 'Memory'], data: data})
  }

  generateTable()
  table.focus()
  setInterval(generateTable, 3000)


  // Set log data.
  log.log('starting process');
  screen.render();

  setInterval(function() {
    log.log('Request time ' + Math.random().toFixed(2));
    screen.render()
  }, 500)


//set spark dummy data
  var spark1 = [1,2,5,2,1,5,1,2,5,2,1,5,4,4,5,4,1,5,1,2,5,2,1,5,1,2,5,2,1,5,1,2,5,2,1,5]
  var spark2 = [4,4,5,4,1,5,1,2,5,2,1,5,4,4,5,4,1,5,1,2,5,2,1,5,1,2,5,2,1,5,1,2,5,2,1,5]

  refreshSpark()
  setInterval(refreshSpark, 1000)

  function refreshSpark() {
    spark1.shift()
    spark1.push(Math.random()*5+1)
    spark2.shift()
    spark2.push(Math.random()*5+1)
    sparkline.setData(['Server1', 'Server2'], [spark1, spark2])
  }



//set map dummy markers
  var marker = true
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

    });
  }, 1000);
}

var width = 900;
var height = 600;
var padding = 30;
var ma_json = [];
var data = [],
    townData = [];
var projection, mapPath;
var centered = null;
var support = [];
var precSupportList = [], townSupportList = [];
var mapChoice = 'Town';
var info, svg, totalsBar, tooltip, barGraph;
var filteredTotalsBarData, filteredTotalsBarList;
var svgWidth, infoWidth;
var mapLayer, g;
var precinctsReporting = 0, townsReporting = 0;
var candidates = ['jeff_ballinger', 'alexandra_chandler', 'beej_das', 'rufus_gifford',
'leonard_golder','dan_koh', 'barbara_litalien', 'bopha_malone', 'juana_matias', 'lori_trahan']
var colors = ["#c6994d", "#964ac8", "#70b143", "#bd3e71", "#00cdff",
"#c55039", "#658ec6", "#60532a", "#5d3b75", "#cb88b5"]
var selectedCandidate = 'dan_koh';
var candidateData, totalVoters;
var totalsBarData = {'total_counted':0,
'jeff_ballinger':0, 'alexandra_chandler':0, 'beej_das':0, 'rufus_gifford':0,
'leonard_golder':0,'dan_koh':0, 'barbara_litalien':0, 'bopha_malone':0, 'juana_matias':0, 'lori_trahan':0};
var towns = ["Acton", "Andover", "Ashburnham", "Ashby", "Ayer", "Berlin", "Bolton", "Boxborough",
"Carlisle", "Chelmsford", "Clinton", "Concord", "Dracut", "Dunstable", "Fitchburg", "Gardner",
"Groton", "Harvard", "Haverhill", "Hudson", "Lancaster", "Lawrence", "Littleton", "Lowell",
"Lunenburg", "Marlborough", "Maynard", "Methuen", "Pepperell", "Shirley", "Stow", "Sudbury",
"Townsend", "Tyngsborough", "Westford", "Westminster", "Winchendon"]

var colorScale = d3.scaleLinear()
    .range([0, 1]);

// create pie chart in bottom half of the info box

var barColor = d3.scaleOrdinal()
  .domain(candidates)
  .range(colors);

var xScale = d3.scaleLinear();

var yScale = d3.scaleBand()
  .domain(candidates);

var xAxis = d3.axisBottom()
  .ticks(1)
  .tickSizeOuter(0)
  .scale(xScale);

var yAxis = d3.axisLeft()
  .scale(yScale);

// Precinct = true, town data = false
d3.json('assets/working_map_v3.json', function(err, geojson) {
  d3.csv('assets/assets_real.csv', function(err, voterData) {
    d3.csv('assets/town_data.csv', function(err, townVoterData){
      // initialize arrays
      data = voterData;
      ma_json = geojson;
      townData = townVoterData;

      // update Precinct level data only
      for(var i = 0; i < ma_json.features.length; i += 1){
        var curProp = ma_json.features[i].properties;
        var curDataID = +curProp.dataID;
        if(curDataID !== null){
          curProp['precinctData'] = data[curDataID];
        }
      }
     // grab total reporting precincts and update totals data
     for(var i = 0; i < townData.length; i += 1){
       precinctsReporting += +townData[i].precincts_reported;
       // update totals data and town data
       for (var key in totalsBarData) {
         if(totalsBarData.hasOwnProperty(key)) {
           totalsBarData[key] += +townData[i][key];
         }
       }
     }

     // update town level data
     for(var i = 0; i < ma_json.features.length; i += 1){
       var curProp = ma_json.features[i].properties;
       var curTownName = curProp.NAME10.split(" ")[0].trim();
       var curTownID = towns.indexOf(curTownName);
       if(curTownID >= 0 ){
         curProp['townData'] = townData[curTownID];
       }
     }

     d3.select("#percent_report")
      .html("Reported: " + (precinctsReporting/225*100).toFixed(1) + "%");

      document.getElementById("loader").remove();
      calculateSelectedData();
      refreshGraphs();
    })
  })
});

function calculateSelectedData(){
  // ********** UPDATE SELECTED MAP LEVEL ****************

  // clear previous support list
  townSupportList = [];
  precSupportList = [];
  for (var i = 0; i < ma_json.features.length; i += 1){
    // calculate selected lead/deficit
    var curProp = ma_json.features[i].properties;
    // ************ UPDATE PRECINCT LEVEL *********************
    var curPrecTotal = curProp.precinctData.total_counted;
    // take the highest and lowest values to use in displaying color scale
    var sortedPrecinctData = d3.entries(curProp.precinctData).slice(2, 12);
    var supportExtent = d3.extent(sortedPrecinctData, function(d){return d.value;})
    precSupportList.push(+supportExtent[0]/curPrecTotal);
    precSupportList.push(+supportExtent[1]/curPrecTotal);
    // store supportDiff in an array

    var diffDict = {};
    for (var j = 0; j < sortedPrecinctData.length; j++){
      diffDict[sortedPrecinctData[j].key] = (+sortedPrecinctData[j].value/curPrecTotal);
    }
    curProp.precinctData.support_diff = diffDict;

    // ***************** UPDATE TOWN LEVEL DATA *******************
    var curTownTotal = curProp.townData.total_counted;
    var sortedTownData = d3.entries(curProp.townData).slice(1, 11);
    supportExtent = d3.extent(sortedTownData, function(d){return d.value;})
    townSupportList.push(supportExtent[0]/curTownTotal);
    townSupportList.push(supportExtent[1]/curTownTotal);

    diffDict = {};
    for (var j = 0; j < sortedTownData.length; j++){
      diffDict[sortedTownData[j].key] = (sortedTownData[j].value/curTownTotal);
    }
    curProp.townData.support_diff = diffDict;
  }
  // calculate new colorScale domain
  var curSupportList = townSupportList;
  if(mapChoice === 'Precinct'){
    curSupportList = precSupportList;
  }
  // colorScale.domain([
  //   Math.min(-0.25, d3.extent(curSupportList)[0]),
  //   Math.max(0.25, d3.extent(curSupportList)[1])])
  colorScale.domain(d3.extent(curSupportList));
  refreshData();
}

function refreshGraphs() {
  // ******** Reset Canvas ***********
  $('svg').remove();

  // ************ Variables **********
  width = $(window).width()-2*padding;
  svgWidth = width*3/4
  infoWidth = width/4
  height = 500;

  // *********** Create SVG ****************

  svg = d3.select("#container").append("svg")
    .attr('class', 'mapSVG')
    .attr('width', svgWidth)
    .attr('height', height)
    .style("display", "inline-block")
    .style("text-align", "left");

  // special effects for zooming in
  svg.append('rect')
    .attr('class', 'background')
    .attr('width', svgWidth)
    .attr('height', height)
    .on('click', clicked);

  g = svg.append('g');

  mapLayer = g.append('g')
    .classed('map-layer', true);


  // tooltip
  d3.select('.tooltip').remove();
  tooltip = d3.select('body').append('div')
    .attr('class', 'tooltip')
    .style("opacity", 0);
  // create projection to display map
  // projection = d3.geoTransverseMercator()
  //   .rotate([74 + 30 / 60, -38 - 50 / 60]);
  projection = d3.geoTransverseMercator()
  .rotate([74 + 30 / 60, -38 - 50 / 60]);

    // ******* Generate path *******
  projection.fitSize([svgWidth, height], ma_json);

  mapPath = d3.geoPath().projection(projection);

  var enter = mapLayer.selectAll(".precinct")
  .data(ma_json.features, function(d){
    if(d.properties.dataID !== null){
      return d.properties.dataID;
    }
  })
  .enter()
  .append("path")
  .attr('id', function(d){
    return d.properties.dataID
  })
  .attr("d", function(d){
    return mapPath(d)
  })
  .attr("class", "precinct")
  .attr('vector-effect', 'non-scaling stroke')
  .attr('fill', function(d){
    return color(d);
  })
  .on('mouseover', function(d){
    d3.select(this).style('fill', "orange");
    tooltip.transition()
      .duration(200)
      .style("opacity", .9);
  })
  .on('mouseout', function(d) {
    mapLayer.selectAll('.precinct')
      .style('fill', function(d){return centered && d===centered ? '#D5708B' : color(d);});
    tooltip.transition()
      .duration(200)
      .style("opacity", 0);
  })
  .on('mousemove', function(d) {
    tooltip
      .html(d.properties.NAME10)
      .style("left", (d3.event.pageX + 12) + "px")
      .style("top", (d3.event.pageY - 12) + "px");
  })
  .on('click', clicked);

  // draw graphs
  drawGraphs();
}

function drawGraphs(){
  // description
  info = d3.select("#container").append("svg")
    .attr('id', 'infoSVG')
    .attr('class', 'info')
    .attr('width', infoWidth)
    .attr('height', height)
    .style('overflow', 'visible');

  info.append('rect')
    .attr('width', infoWidth)
    .attr('height', height);

  // create info info barGraph
  barGraph = info.append('g')
    .attr("transform", `translate(${padding*4}, ${height/3})`)

  // create totalsBar
  totalsBar = d3.select("#container").append('svg')
    .attr('id', 'totalsBar')
    .attr('width', infoWidth+svgWidth)
    .attr('height', height/20);


  filteredTotalsBarData = Object.keys(totalsBarData)
      .reduce(function (filteredTotalsBarData, key) {
      if (!key.includes('total')) filteredTotalsBarData[key] = totalsBarData[key];
      return filteredTotalsBarData;
  }, {});
  filteredTotalsBarList = [filteredTotalsBarData];

  // draw a stacked bar chart
  refreshStackedBar();

  displayInfo(totalsBarData);
}

// zoom in and out functionality
function clicked(d) {

  var x, y, k;

  // Compute centroid of the selected path
  if (d && centered !== d) {
    var centroid = mapPath.centroid(d);
    x = centroid[0];
    y = centroid[1];
    k = 4;
    centered = d
    if(mapChoice === 'Precinct'){
      displayInfo(d.properties.precinctData);
    } else if(mapChoice === 'Town'){
      displayInfo(d.properties.townData);
    }

  } else {
    x = svgWidth / 2;
    y = height / 2;
    k = 1;
    centered = null;
    displayInfo(totalsBarData);
  }

  // Highlight the clicked province
  mapLayer.selectAll('.precinct')
    .style('fill', function(d){return centered && d===centered ? '#D5708B' : color(d);});

  // Zoom
  g.transition()
    .duration(750)
    .attr('transform', 'translate(' + svgWidth / 2 + ',' + height / 2 + ')scale(' + k + ')translate(' + -x + ',' + -y + ')');
};

function barOver(d){
    d3.select(this.parentNode).select('rect')
      .style('opacity', "0.8")
      .style('stroke-width', '2')
      .style('stroke', '#ddd')
    tooltip.transition()
      .duration(200)
      .style("opacity", .9);
}
function barMove() {
    var name = d3.select(this.parentNode).select('rect').attr('title');
    var d = d3.select(this.parentNode).select('rect').datum()[0];
    tooltip
      .html(nameFormat(name) +
      "<br>" +
      ((d[1]-d[0])/totalVoters*100).toFixed(1)+"%")
      .style("left", (d3.event.pageX + 12) + "px")
      .style("top", (d3.event.pageY - 12) + "px");
}

function barOut(d){
    mapLayer.selectAll('.precinct')
      .style('fill', function(d){return centered && d===centered ? '#D5708B' : color(d);});
    tooltip.transition()
      .duration(500)
      .style("opacity", 0);
    d3.select(this.parentNode).select('rect')
      .style('opacity', 1.0)
      .style('stroke-width', 0);
}

function barClick(d){
  // update selected candidate display
  curCandidate = d3.select(this.parentNode).select('rect').attr('title');
  if(curCandidate !== selectedCandidate){
    selectedCandidate = curCandidate
    d3.select('#stats')
      .html(function(){
        return d3.select(this).text().split(':')[0] + ": " +
        `<b>${nameFormat(curCandidate)}</b>`;
      })
    refreshData();
  }
}

function color(d){
  // loop through and grab candidate data to interpolate
  var raw_diff = +d.properties.townData.support_diff[selectedCandidate];
  if(mapChoice === 'Precinct'){
    raw_diff = +d.properties.precinctData.support_diff[selectedCandidate];
  }
  return d3.interpolateRdYlGn(colorScale(raw_diff));
}

// ******* Actions that Require Altering SVG *******
$(window).resize(function() {
  refreshGraphs();
});

function changeDataChoice() {
  checkbox = document.getElementById("slider");

  if(checkbox.checked){
    mapChoice = 'Precinct';
  } else {
    mapChoice = 'Town';
  }
  refreshData();
}

function refreshData() {
  // *********** Update colors ********************8
  var update = d3.selectAll('.precinct')
    .transition().duration(500)
    .style("fill", function(d) {
      if(d3.select(this).style('fill') !== 'rgb(213,112,139)'){
        return color(d);
      }
    })
}

function refreshStackedBar(){
  var stack = d3.stack()
    .keys(candidates);

  var layers = stack(filteredTotalsBarList);
  totalVoters = layers[9][0][1];

  d3.select('#total_count')
    .html(function(){
      return d3.select(this).text().split(':')[0] + ": " +`<b>${totalVoters}</b>`;
    })

  var xBarScale = d3.scaleLinear()
    .domain([0, totalVoters])
    .range([0, width])

  var totalsLayer = totalsBar.selectAll('.totalsLayer')
    .data(layers).enter()
    .append('g')
      .attr('class', 'totalsLayer')
      .attr('fill', function(d, i){
        return colors[i];
      })

  totalsLayer.selectAll("rect")
    .data(function(d, i) {
      d[0].index = i;
      return d;
    })
  .enter().append("rect")
    .attr("x", function(d) {
      return d[0]/totalVoters *width;
    })
    .attr("height", height/20)
    .attr("width", function(d) { return (d[1]-d[0])/totalVoters*width; })
    .attr("title", function(d){
      return Object.keys(d.data)[d.index];
    })
    .on('click', barClick)
    .on('mouseover', barOver)
    .on('mouseout', barOut)
    .on('mousemove', barMove)
    totalsLayer.append('text')
      .attr('x', function(d){
        return d[0][0]/totalVoters *width + 6;
      })
      .attr('y', height/40)
      .on('click', barClick)
      .on('mouseover', barOver)
      .on('mouseout', barOut)
      .on('mousemove', barMove)
      .style('text-anchor', 'start')
      .style('alignment-baseline', 'central')
      .style('font', '12px sans-serif')
      .style('fill', 'black')
      .text(function(d){
        // prevent text from being cut off
        var percentage = ((d[0][1]-d[0][0])/totalVoters*100).toFixed(1);
        if(percentage > 2){
          return percentage +"%";
        }

    });
    totalsLayer.append('text')
      .attr('x', function(d){
        return d[0][1]/totalVoters*width - 6;
      })
      .attr('y', height/40)
      .on('click', barClick)
      .on('mouseover', barOver)
      .on('mouseout', barOut)
      .on('mousemove', barMove)
      .style('text-anchor', 'end')
      .style('alignment-baseline', 'central')
      .style('font', '12px sans-serif')
      .style('fill', 'black')
      .text(function(d){
        if((d[0][1]-d[0][0])/totalVoters > 0.1){
          return nameFormat(d.key);
        }
    });
}

function displayInfo(dictData){
  candidateData = d3.entries(dictData);

  if(centered !== null){
    if(mapChoice === 'Precinct'){
      infoSVGData = [candidateData[1]].concat(candidateData.slice(-3, -1));
    } else if(mapChoice === 'Town'){
      infoSVGData = [candidateData[0], candidateData[11],
      {'key': 'Precincts Reporting',
      'value': `${candidateData[12].value} of ${candidateData[13].value}` }];
    }
  } else if (centered === null){
    infoSVGData = [{'key':'Precincts', 'value': precinctsReporting +" of 225"}]
    .concat(candidateData.slice(0, 1));
  }


  // cut up data into totals, % supports and pie chart data
  d3.selectAll('.infoText').remove();
  var displayInfo = info.selectAll('.totalsData')
    .append('g')
    .attr('class', 'totalsData')
    .data(infoSVGData, function(d){
      return d.key;
    })
    .enter().append('g')
    .attr('transform', function(d, i){
      return `translate(${padding}, ${padding +i*20})`
    });

  displayInfo.append('text')
      .attr('class', 'infoText')
      .attr('x', '0')
      .attr('text-anchor', 'start')
      .text(function(d){
        return nameFormat(d.key);
      })
  displayInfo.append('text')
    .attr('class', 'infoText')
    .attr('x', infoWidth - 2*padding)
    .attr('text-anchor', 'end')
    .text(function(d){
      return d.value;
    })
    updateBar(candidateData);
}

function updateBar(curLocationData){
  var barLength = (infoWidth) - 4*padding,
      barHeight = (height)/20;
  // draw bar graph
  // remove extra data from bar graph

  if(mapChoice === 'Town' || centered === null){
    var barData = curLocationData.slice(1, 11);
  } else if(mapChoice === 'Precinct'){
      var barData = curLocationData.slice(2, 12);
  }

  // scale range of data

  yScale.range([0, height/2]);

  xScale.range([0, barLength-padding]);
  var maxValue = d3.max(barData, function(d){
    return +d.value;
  })
  xScale.domain([0, maxValue*3/2]);


  d3.selectAll('.barData').remove();
  var barUpdate = barGraph.selectAll('.barData')
    .data(barData, function(d){
      return d.key+d.value;
    })

  barUpdate.selectAll('rect')
    .transition().duration(200)
    .attr('width', function(d){
      return xScale(+d.value);
    });

  var bar = barUpdate.enter()
    .append('g')
    .attr('class', 'barData')
    .attr('transform', function(d){
      return `translate(0, ${yScale(d.key)})`;
    })
  bar.append("rect")
    .attr('width', function(d){
      return xScale(+d.value);
    })
    .attr('height', barHeight)
    .attr('fill', function(d){
      return barColor(d.key);
    })
    bar.append('text')
      .text(function(d){
        return d.value;
      })
      .attr('x', function(d){
        return xScale(+d.value) + 6;
      })
      .attr('y', 6)
      .style('alignment-baseline', 'hanging')
      .style('text-align', 'start')
      .style('fill', function(d){
        return barColor(d.key);
      })

    barGraph.append('g')
      .attr('id', 'xAxis')
      .attr("transform", `translate(0, ${height/2})`);
    d3.select('#xAxis')
      .call(xAxis);
    barGraph.append('g')
      .attr('id', 'yAxis')
    d3.select('#yAxis')
      .call(yAxis)
      .selectAll('text')
      .text(function(d){
        return nameFormat(d3.select(this).text());
      })
      // now rotate text on x axis
      // solution based on idea here: https://groups.google.com/forum/?fromgroups#!topic/d3-js/heOBPQF3sAY
      // first move the text left so no longer centered on the tick
      // then rotate up to get 45 degrees.
}

function nameFormat(nameString){
  var names = nameString.split("_");
  var first = names[0].charAt(0).toUpperCase() + names[0].substr(1);
  var last = "";
  if(names.length > 1){
    last = names[1].charAt(0).toUpperCase() + names[1].substr(1);
  }

  return first + " " + last;
}

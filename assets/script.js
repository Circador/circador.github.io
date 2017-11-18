var svg_info, div, projection; // global D3/SVG elements
const width = 1200;
const height = 600;
var margin = {top: 50, bottom: 50, left: 50, right: 150};
const colors = {'v':"#dccdad", 'a':"#b5c4e2", 'n':"#afd7c3", 'r':"#e6b7bb"};
var parts = {'v':'verb', 'a': 'adjective', 'n':'noun', 'r':'adverb'};
var dataset = [];
var displaySet = [];
var recipes = [];
var displayRecipes = [];
var curColors = ['v', 'a', 'n', 'r'];

// ********* Create SVG *********
var svg = d3.select("#svg-container").append('svg')
.attr('id', "graph")
.attr('width', width)
.attr('height', height);

// ******** NODES **********
var nodes = svg.append("g")
.attr("class", "nodes");

// ******** TOOLTIP *********
var tooltip = d3.select("#svg-container")
.append('div')
.attr('id', 'tooltip')

// ******** Review Box ********
var reviewBox = d3.select("#info")
.attr('width', width)
.attr('height', height)

// ******** Draw Legend *********
var legend_scale = d3.scaleLinear()
.domain([0,3])
.range([0, height/6])

var legend = svg.append('g')
.attr('id', 'legend')
.attr('width', margin.right)
.attr('height', height)
.attr('transform', `translate(${width-margin.right}, ${margin.top})`);

var legend_entry = d3.select("#legend").selectAll('.parts')
.data(curColors, function(d){
})
.enter().append('g')
.attr('class', 'parts')
.attr('transform', function(d, i){
  return `translate(0, ${legend_scale(i)})`;
})
legend_entry.append('circle')
.attr('r', 10)
.on("click", function(d){
  // toggle visibility of the parts of speech
  if(curColors.includes(d)){
    // remove entry
    var index = curColors.indexOf(d);
    curColors.splice(index, 1);
    d3.select(this).transition().duration(250)
      .attr('fill-opacity', 0.25)
    refreshData();
  } else{
    // add entry
    curColors.push(d);
    d3.select(this).transition().duration(250)
      .attr('fill-opacity', 1)
    refreshData();
  }
})
.style('fill', function(d){
  return colors[d];
})
.style('stroke', 'grey')
legend_entry.append('text')
.attr('x', margin.right)
.html(function(d){
  return parts[d];
})

// ******** RADIUS SCALE *********
// use square root scale, so that the area of the word scales linearly with frequency
// minimize lie factor
var r_scale = d3.scalePow()
.exponent(0.5)
.range([10, 50])

// ******** X SCALE **********
var x_scale = d3.scaleLinear()
.domain([-5, 5])
.range([margin.left, width-margin.right]);


// ******** CREATE SIMULATION *********
// with special help from https://bl.ocks.org/mbostock/1129492

var simulation = d3.forceSimulation()
// .force("center", d3.forceCenter(width/2, height/2))
.force("charge", d3.forceManyBody()[-50])
.force("x", d3.forceX(function(d){
  return x_scale(d.rating);
}).strength(1))
.force("y", d3.forceY(height/2))
.force("collision", d3.forceCollide()
.radius(function(d) {
  return r_scale(d.frequency);
}).strength(1)
);

// ******** DATA LOAD **********

d3.csv("data-happy-final.csv", function(error, data) {
  if (error) throw error;
  // pass data outside of csv fxn
  dataset = data;
  d3.csv("reviews.csv", function(error, data) {
    if (error) throw error;
    recipes = data;
    refreshData();
  })
});

function refreshData(){
  // restart simulation
  simulation.alpha(0.3).restart();
  // filter according to legends selections and parts of speech
  displaySet = dataset.filter(function(d){
    return curColors.includes(d.pos);
  })
  // Grab up to the top 50 words by frequency
  displaySet = displaySet.sort(function(a, b){
    return b.frequency - a.frequency;
  }).slice(0, 75);

  // update r_scale
  var frequencyVal = []
  // update x_scale
  var displayVal = []
  for(var i = 0; i < displaySet.length; i++){
    frequencyVal.push(+displaySet[i].frequency);
    displayVal.push(+displaySet[i].rating)
  }
  x_scale.domain(d3.extent(displayVal));
  r_scale.domain(d3.extent(frequencyVal));

  // ********** X AXIS ************
  d3.select('#x_axis').remove();
  var svg = d3.select("#graph")
  var x_axis = d3.axisBottom(x_scale).ticks(5)
  svg.append('g')
  .attr('id', "x_axis")
  .attr('transform', `translate(0, ${height/2})`)
  .call(x_axis)
  .append('text')
  .html('Sentiment')
  .attr('x', margin.left/2)
  .attr('y', margin.bottom)
  .style('text-anchor', 'start')
  .style('dominant-baseline', 'middle')
  .style('font-size', '32px')
  .style('font-family', 'Roboto Slab')
  .style('fill', 'black')

  // UPDATE SELECTION
  var update = nodes
  .selectAll("circle")
  .data(displaySet, function(d){
    return d.author+d.rating;
  });

  // ENTER SELECTION
  var enter = update.enter()
  .append("circle");
  enter
  .attr("r", function(d){
    return r_scale(d['frequency']);
  })
  .style("fill", function(d) {
    return colors[d.pos];
  })
  .call(d3.drag()
  .on("start", dragstarted)
  .on("drag", dragged)
  .on("end", dragended)
  )
  // with special help from here: https://medium.freecodecamp.org/a-gentle-introduction-to-d3-how-to-build-a-reusable-bubble-chart-9106dc4f6c46
  .on("mouseover", function(d){
    d3.select(this).transition().duration(250)
      .attr('r', function(d){
        return 1.25*r_scale(d.frequency);
      })
      .style('fill', function(d) {
        return d3.rgb(colors[d.pos]).brighter(0.4);
      })
    var displayText = `${d.pos}, ${d.word}<br>Rating: ${parseFloat(d.rating).toFixed(2)}<br>
    Frequency: ${d.frequency}`
    tooltip.html(displayText);
    return tooltip.style("visibility", "visible");
  })
  .on("mousemove", function(){
    return tooltip.style("top", (d3.event.pageY+5)+"px").style("left",(d3.event.pageX+5)+"px");
  })
  .on("mouseout", function(){
    d3.select(this).transition().duration(250)
      .attr('r', function(d){
        return r_scale(d.frequency);
      })
      .style('fill', function(d) {
        return colors[d.pos];
      })
    return tooltip.style("visibility", "hidden");
  })
  .on("click", function(d){
    return drawInfo(d.word);
  })
  // ******* ENTER TRANSITION *********
  enter
  .style('fill-opacity', 0)
  .transition().duration(250)
  .style('fill-opacity', 1)

  // *********** EXIT SELECTION **********
  var exit = update.exit().transition().duration(500)
    .style('fill-opacity', 0)
    .attr('stroke-width', '0px')
    .remove();

  var node = update.merge(enter)
  // with special help from here: https://bl.ocks.org/shimizu/e6209de87cdddde38dadbb746feaf3a3

  simulation
  .nodes(displaySet)
  .on("tick", ticked);

  function ticked() {
    node
    .attr("cx", function(d) {
      return d.x;
    })
    .attr("cy", function(d) { return d.y; });
  }
}
//Movement
function dragstarted(d) {
  if (!d3.event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(d) {
  d.fx = d3.event.x;
  d.fy = d3.event.y;
}

function dragended(d) {
  if (!d3.event.active) simulation.alphaTarget(0);
  d.fx = x_scale(d.rating);
  d.fy = null;
}


// ********* Update Info Box ************
function drawInfo(word){
  d3.select("#reviewBoxHeader").html(`Reviews containing: ${word}`)
  displayRecipes = recipes.filter(function(d){
    // checks whether the review contains the clicked word and then adds it to the data
    var regex = new RegExp(`\\b${word}\\b`);
    if(regex.test(d.review)){
      d.word = word;
      return true;
    }
    return false;
  }).slice(0, 10)

  // UPDATE SELECTION
  var update = reviewBox.selectAll(".reviews")
  .data(displayRecipes, function(d){
    // object constancy using author's name
    console.log('working')
    return d.author;
  })
  update.transition().duration(500)
  .attr("transform", function(d, i){
    return `translate(0, ${i*200})`;
  })
  // author name and rating
  update.select("h4")
  .html(function(d){
    return review_header(d);
  })
  update.select("p")
  .html(function(d){
    return review_text(d);
  })

  // ENTER SELECTION
  var enter = update.enter().append("div")
  .attr("class", "reviews")

  enter
  .attr('opacity', 0)
  .attr("transform", "translate(0, 0)")
  .transition().duration(500)
  .attr('opacity', 1)
  .attr("transform", function(d, i){
    return `translate(0, ${i*200})`;
  })
  var reviewHead = enter.append('div')
  .style('overflow', 'hidden')
  .style('vertical-align', 'middle');
  reviewHead.append("h4")
  .html(function(d){
    return review_header(d);
  })
  .style('display','inline-block')
  .style('float', 'left');

  reviewHead.append("h2")
  .html(function(d){
    return `${d.rating}/10`;
  })
  .style('display', 'inline-block')
  .style('float', 'right')

  enter.append("p")
  .html(function(d){
    return review_text(d);
  })

  // EXIT SELECTION
  var exit = update.exit()
  .transition().duration(500)
  .style("opacity", 0)
  .remove();
}


// ********* INFO BOX HELPER FUNCTIONS **********
// return formatted header
function review_header(d){
  return `${d.author}<br>${d.date}`;
}
// return highlighted text
function review_text(d){
  // highlight review by adding highlighted element
  var highlight = `<span style="background-color: #FFFF00">${d.word}</span>`
  // replace all instances of the word with highlight expressions
  var new_review = d.review.replace(new RegExp(d.word, "g"), highlight)
  return new_review;
}

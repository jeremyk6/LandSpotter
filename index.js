var map;
var parcelles_geojson = L.geoJSON();
tolerance = 100;

// Fonction pour mettre à jour les suggestions de villes
function updateSuggestions(input) {
  if (input.length > 3) {
    // Appel à l'API avec la valeur actuelle de l'input
    fetch(
      "https://api-adresse.data.gouv.fr/search/?type=municipality&q=" + input,
    )
      .then((response) => response.json())
      .then((data) => {
        // On vide la liste existante
        list = document.getElementById("noms_communes");
        list.innerHTML = "";
        // On ajoute les nouvelles suggestions
        for (feature of data.features) {
          const option = document.createElement("option");
          option.id = feature.properties.id;
          option.value =
            feature.properties.name + " (" + option.id.substr(0, 2) + ")";
          list.appendChild(option);
        }
      });
  }
}

function search() {
  name = document.getElementById("input_noms_communes").value;
  code_insee = document.querySelector(
    "#noms_communes option[value='" + name + "']",
  ).id;
  fetch(
    "https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/communes/" +
      code_insee.substr(0, 2) +
      "/" +
      code_insee +
      "/cadastre-" +
      code_insee +
      "-parcelles.json.gz",
  )
    .then((response) => response.blob())
    .then((blob) => {
      blob.arrayBuffer().then((buffer) => {
        var decompressed = pako.inflate(new Uint8Array(buffer), {
          to: "string",
        });
        var geojson = JSON.parse(decompressed);
        parcelles_geojson.addData(geojson);
        datatable = [];
        parcelles_geojson.eachLayer((layer) => {
          datatable.push({
            "parcelle":layer.feature.properties.numero, 
            "surface":layer.feature.properties.contenance,
            "ecart": ((Math.abs(document.getElementById("surface").valueAsNumber - layer.feature.properties.contenance) / ((document.getElementById("surface").valueAsNumber + layer.feature.properties.contenance) / 2)) * 100).toFixed(2),
            "feature": layer.feature
          });
        });
        fillTable(datatable);
        display_results();
      });
    });
}

function fillTable(datatable) {
  clearTable();

  datatable.sort((a, b) => a.ecart - b.ecart);
  datatable = datatable.slice(0, 10);

  // remove features that are not part of datatable
  parcelles_geojson.eachLayer((layer) => {
    if (!datatable.find((d) => d.feature === layer.feature)) {
      parcelles_geojson.removeLayer(layer);
    }
  });

  for (let i = 0; i < datatable.length; i++) {
    row = results_table.insertRow(-1);
    parcelle = row.insertCell(0);
    surface = row.insertCell(1);
    rank = row.insertCell(2);
    maps = row.insertCell(3);
    parcelle.innerHTML = datatable[i].parcelle;
    surface.innerHTML = datatable[i].surface;
    rank.innerHTML = datatable[i].ecart;
    
    var centroid = L.geoJSON(datatable[i].feature).getBounds().getCenter();
    maps.innerHTML = `<a href="https://www.google.com/maps/@`+centroid.lat+`,`+centroid.lng+`,`+100+`m/data=!3m1!1e3`+`" target="_blank"><img id="mlogo" src="images/maps_logo.png"></a>`;

    // hightlight feature on hover
    row.addEventListener("mouseover", () => {
      parcelles_geojson.eachLayer((layer) => {
        if (layer.feature === datatable[i].feature) {
          layer.setStyle({
            weight: 2,
            color: "yellow",
            fillOpacity: 0,
          });
        } else {
          layer.setStyle({
            weight: 2,
            color: "red",
            fillOpacity: 0,
          });
        }
      });
    });

    // fly to feature on click
    row.addEventListener("click", () => {
      parcelles_geojson.eachLayer((layer) => {
        if (layer.feature === datatable[i].feature) {
          map.flyToBounds(layer.getBounds());
        }
      });
    });
  } 
  
  parcelles_geojson.eachLayer((layer) => {
    layer.setStyle({
      weight: 2,
      color: "red",
      fillOpacity: 0,
    });
  });

  map.fitBounds(parcelles_geojson.getBounds());
}

function clearTable() {
  results_table = document.getElementById("results");
  results_table.innerHTML = "";
}

function display_results() {
  document.getElementById("search_container").style.display = "none";
  document.getElementById("result_container").style.display = "block";
}

function display_search() {
  clearTable();
  parcelles_geojson.clearLayers();

  // On masque le div des résultats et on affiche le div de recherche
  document.getElementById("search_container").style.display = "block";
  document.getElementById("result_container").style.display = "none";

  // Configuration du champ de recherche: on ajoute l'event sur le champ
  const searchInput = document.getElementById("input_noms_communes");
  searchInput.value = "";
  searchInput.addEventListener("input", () =>
    updateSuggestions(searchInput.value),
  );

  //document.getElementById("limitrophes").checked = false;
}

function init() {
  display_search();

  // Enable to change the base map
  osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })

  ign = L.tileLayer(
    'http://wms.openstreetmap.fr/tms/1.0.0/orthohr/{z}/{x}/{y}.jpg', 
    {
      maxZoom : 19,  
      attribution : 'IGN BD Ortho ©'
    }
  )

  // Configuration de la webmap
  map = L.map("map", {
    center: [46.5, 3.1],
    zoom: 5,
    layers: [osm, ign]
  });

  var baseMaps = {
    "OpenStreetMap": osm,
    "IGN": ign
  };
  var layerControl = L.control.layers(baseMaps).addTo(map);


  /* Set zoom & position if in parameters */
  params = new URLSearchParams(window.location.search);
  try {
      params = params.get("map").split("/")
      z = Number(params[0])
      x = Number(params[1])
      y = Number(params[2])
      map.setView([x,y], z);
  } catch {
      map.setView([47.123,4.658], 6);
  }

  /* On every move/zoom end... */
  map.on('moveend zoomend', function() {
      /* ... update zoom and position in url */
      params = "map="+map.getZoom()+"/"+map.getCenter().lat+"/"+map.getCenter().lng
      url = window.location.protocol + "//" + window.location.host + window.location.pathname + '?' + params;
      window.history.pushState({path: url}, '', url);
  });

  parcelles_geojson.addTo(map);
}

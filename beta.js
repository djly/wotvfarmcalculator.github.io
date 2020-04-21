var version = "v2";

var fileList = {
  'ItemName': 'data/en/ItemName.json',
  'ArtifactName': 'data/en/ArtifactName.json',
  'ItemImageMap': 'data/ItemImageMap.json',
  'ItemAtLeastOne': 'data/ItemAtLeastOne.json',
  'ItemChance': 'data/ItemChance.json',
  'ItemQuests': 'data/ItemQuests.json',
  'Quests': 'data/Quests.json',
  'ElementalItems': 'data/ElementalItems.json',
  'JobMaterials': 'data/JobMaterials.json',
  'Characters': 'data/Characters.json',
  'ItemRecipes': 'data/ItemRecipes.json',
};

var loadedData = {};

for (let [key, url] of Object.entries(fileList)) {
  fetch(url)
    .then((response) => {
      console.log(url);
      return response.json();
    })
    .then((data) => {
      loadedData[key] = data;
    });
}

let preload = null;
$(document).ready(function () {
  preload = setInterval(function () {
    if (Object.keys(fileList).length === Object.keys(loadedData).length) {
      start();
    }
  }, 100);
});

var materialsList = [];
var matchedStories = {};
var autocompleteData = [];
var translation = {};
var templates = {};

function start() {
  clearInterval(preload);

  var translationKeys = [
    'ItemName',
    'ArtifactName',
  ];
  translationKeys.forEach(function (translationKey) {
    translation[translationKey] = {};
    loadedData[translationKey]['infos'].forEach(function (keyValue) {
      translation[translationKey][keyValue.key] = keyValue.value;
    });
  });

  initTemplates();

  // Build the structure for the autocomplete.
  Object.keys(loadedData["ItemQuests"]).forEach(function (itemCode) {
    var entry = {
      'iname': itemCode,
      'value': translation['ItemName'][itemCode],
      'type': 'item',
    };
    entry.materialLabel = getMaterialImageOrLabel(entry, true);
    autocompleteData.push(entry);
  });

  Object.keys(loadedData["Characters"]).forEach(function (characterName) {
    var entry = {
      'iname': characterName,
      'value': 'Character: ' + characterName,
      'type': 'character',
      'materialLabel': 'Character: ' + characterName,
    };
    autocompleteData.push(entry);
  });

  Object.keys(loadedData["JobMaterials"]).forEach(function (jobName) {
    var entry = {
      'iname': jobName,
      'value': 'Job: ' + jobName,
      'type': 'job',
      'materialLabel': 'Job: ' + jobName,
    };
    autocompleteData.push(entry);
  });

  Object.keys(loadedData["ItemRecipes"]).forEach(function (artifactIName) {
    var entry = {
      'iname': artifactIName,
      'value': 'Equipment: ' + translation['ArtifactName'][artifactIName],
      'type': 'recipe',
      'materialLabel': 'Equipment: ' + translation['ArtifactName'][artifactIName],
    };
    autocompleteData.push(entry);
  });

  initTypeAhead();

  $('.typeahead').on('typeahead:select', handleCallback);

  var $body = $('body');
  $body.on('click', '.toggle-dark-mode', function (e) {
    $('.toggle-dark-mode').hide();
    $('.toggle-light-mode').show();
    $body.addClass('dark-mode');
    localStorage.setItem('darkMode', '1');
  });

  $body.on('click', '.toggle-light-mode', function (e) {
    $('.toggle-dark-mode').show();
    $('.toggle-light-mode').hide();
    $body.removeClass('dark-mode');
    localStorage.setItem('darkMode', '');
  });

  if (localStorage.getItem('darkMode') === '1') {
    $('.toggle-dark-mode').hide();
    $('.toggle-light-mode').show();
    $body.addClass('dark-mode');
  }

  $body.on('click', '.materials-list .btn-close', deleteMaterial);
  $body.on('click', '.btn-clear-all', clearAll);

  loadFromLocalStorage();
}


/**
 *
 * @param e
 * @param suggestion
 */
function handleCallback(e, suggestion) {
  var $typeahead = $('.typeahead');
  $typeahead.typeahead('val', '');
  $typeahead.focus();

  switch (suggestion.type) {
    case 'item':
      addMaterial(suggestion);
      break;
    case 'character':
      addCharacterMaterials(suggestion);
      break;
    case 'job':
      addJobMaterials(suggestion);
      break;
    case 'recipe':
      addRecipeMaterials(suggestion);
      break;
  }
}

/**
 *
 *
 * @param material
 */
function addMaterial(material) {
  // Normalize structure.
  if (typeof material === 'string') {
    material = {
      iname: material,
      value: translation['ItemName'][material]
    }
  }

  if (materialsList.includes(material.iname)) {
    return;
  }

  materialsList.push(material.iname);
  addMaterialToDom(material);

  updateLocalStorage();
  calculate();
}


/**
 * Add all materials related to a job name.
 *
 * @param job
 */
function addJobMaterials(job) {
  // Normalize structure.
  if (typeof job === 'string') {
    job = {
      iname: job,
      value: job
    }
  }

  if (!loadedData['JobMaterials'].hasOwnProperty(job.iname)) {
    return;
  }

  loadedData['JobMaterials'][job.iname].forEach(addMaterial);
}

/**
 * Add all materials related to a character name.
 *
 * @param charName
 */
function addCharacterMaterials(charName) {
  if (!loadedData['Characters'].hasOwnProperty(charName.iname)) {
    return;
  }

  // First prop is the character element.
  addElementMaterials(loadedData['Characters'][charName.iname].element);

  // Rest of the props are job names.
  loadedData['Characters'][charName.iname].jobs.forEach(addJobMaterials);
}

/**
 * Add all materials related to an element.
 *
 * @param elementName
 */
function addElementMaterials(elementName) {
  if (!loadedData['ElementalItems'].hasOwnProperty(elementName)) {
    return;
  }

  loadedData['ElementalItems'][elementName].forEach(addMaterial);
}

/**
 * Add all materials related to an equipment name.
 *
 * @param recipe
 */
function addRecipeMaterials(recipe) {
  if (!loadedData['ItemRecipes'].hasOwnProperty(recipe.iname)) {
    return;
  }

  loadedData['ItemRecipes'][recipe.iname].forEach(addMaterial);
}

/**
 * Updates the DOM to show the passed material.
 *
 * @param material
 */
function addMaterialToDom(material) {
  var materialItem = applyTemplate('MaterialItem', {
    'material': material.iname,
    'materialLabel': getMaterialImageOrLabel(material, true),
  });

  $('.materials-list').append(materialItem);
}

/**
 * Gets the material's img element or a text label if no image available.
 *
 * @param material
 * @param includeText
 */
function getMaterialImageOrLabel(material, includeText) {
  if (!loadedData['ItemImageMap'].hasOwnProperty(material.iname)) {
    return material.iname;
  }

  // We don't have images for all materials, so return the label if empty.
  if (!loadedData['ItemImageMap'][material.iname]) {
    return material.iname;
  }

  // Coerce the image layers to be uniformly arrays.
  var layers = loadedData['ItemImageMap'][material.iname];
  if (!Array.isArray(loadedData['ItemImageMap'][material.iname])) {
    layers = [loadedData['ItemImageMap'][material.iname]];
  }

  var layerHtml = '';
  layers.forEach(function (layer) {
    layerHtml += getMaterialLayerImageHtml(material, layer);
  });

  var html = applyTemplate('MaterialIconWrapper', {
    'layers': layerHtml,
    'includedText': includeText ? material.value : ''
  });

  return html;
}

/**
 * Defines a utility function to build a single material icon layer.
 *
 * @param material
 * @param image
 * @returns {string}
 */
function getMaterialLayerImageHtml(material, image) {
  var typeClass = '';
  if (image.indexOf('job/') >= 0) {
    typeClass = 'material-icon-job';
  }
  if (image.indexOf('gear/') >= 0) {
    typeClass = 'material-icon-gear';
  }
  if (image.indexOf('itemicon_job_') >= 0) {
    typeClass = 'material-icon-memory';
  }

  return applyTemplate('MaterialIconLayer', {
    'image': image,
    'typeClass': typeClass,
    'material': material.value
  });
}

/**
 * Delete material from array and DOM.
 */
function deleteMaterial() {
  var $parent = $(this).parents('.input-group').first();
  var material = $parent.data('material');
  $parent.remove();
  materialsList.splice(materialsList.findIndex(a => a === material), 1);
  updateLocalStorage();
  calculate();
}

/**
 * Take the list of materials and figure out which story quests match.
 */
function calculate() {
  if (!materialsList.length) {
    $('.feedback').html('<div class="alert alert-danger" role="alert">Add materials first.</div>');
    return;
  }

  $('.feedback').html('');

  // @todo: finish this.
  return;

  matchedStories = {};

  for (let [storyName, storyMaterials] of Object.entries(stories)) {
    let matchedMaterials = storyMaterials.filter(x => materialsList.includes(x));
    if (!matchedMaterials.length) {
      continue;
    }

    matchedStories[storyName] = matchedMaterials;
  }

  var sortedMatchedStories = Object.keys(matchedStories)
    .map(function (k) {
      return {key: k, value: matchedStories[k]};
    })
    .sort(function (a, b) {
      return b.value.length - a.value.length;
    });

  $('.story-quest-list tbody').html('');
  sortedMatchedStories.forEach(function (matchedStory) {
    var storyName = matchedStory['key'];
    var storyMaterials = matchedStory['value'];
    var allMats = stories[storyName];

    var storyMaterialIcons = [];
    storyMaterials.forEach(function (storyMaterial) {
      storyMaterialIcons.push(getMaterialImageOrLabel(storyMaterial));
    });

    var allMatsLabels = [];
    allMats.forEach(function (storyMaterial) {
      var escaped = getMaterialImageOrLabel(storyMaterial, true).replace(/"/g, "&quot;");
      allMatsLabels.push(escaped);
    });

    var tableRow = applyTemplate('MaterialTableRow', {
      'storyName': storyName,
      'storyMaterialsLength': storyMaterials.length,
      'storyMaterialIcons': storyMaterialIcons.join(' '),
      'allMatsLabels': allMatsLabels.join('<br>'),
    });

    $('.story-quest-list tbody').append(tableRow);
  });

  $('[data-toggle="tooltip"]').tooltip();
}

/**
 * Clear all selected materials from array, localStorage, and DOM.
 */
function clearAll() {
  if (!confirm('Are you sure you want to clear all selected materials?')) {
    return;
  }

  $('.materials-list').html('');
  materialsList = [];
  $('.story-quest-list tbody').html('');

  updateLocalStorage();
}

/**
 * Store the selected materials in local storage.
 */
function updateLocalStorage() {
  localStorage.setItem(version + '.selectedMaterials', JSON.stringify(materialsList));
}

/**
 * Load the selected materials from local storage.
 */
function loadFromLocalStorage() {
  var savedMaterials = localStorage.getItem(version + '.selectedMaterials');
  if (!savedMaterials) {
    return;
  }

  var list = JSON.parse(savedMaterials);
  if (!list.length) {
    return;
  }

  list.forEach(addMaterial);
  calculate();
}

/**
 * Parses the list of materials and adds them as materials to search on.
 */
function doImport() {
  var importList = $('#import').val();
  if (!importList) {
    return;
  }

  importList = importList.split(',');
  importList.forEach(function (importMaterial) {
    addMaterial(importMaterial);
  });

  updateLocalStorage();
}

/**
 * Populates the export textarea with current list of materials.
 */
function populateExport() {
  $('#export').text(materialsList.join(','));
}

/**
 * For a given template, populate the template then return the HTML to be
 * inserted.
 *
 * @returns {*}
 */
function applyTemplate(template, data) {
  return templates[template](data);
}

/**
 *
 */
function initTypeAhead() {
  var autocompleteBH = new Bloodhound({
    datumTokenizer: Bloodhound.tokenizers.obj.nonword('value'),
    queryTokenizer: Bloodhound.tokenizers.nonword,
    //identify: function(obj) { return obj.value; },
    local: autocompleteData
  });

  $('.typeahead').typeahead({
      hint: true,
      highlight: true,
      minLength: 1,
    },
    {
      limit: 50,
      name: 'items',
      source: autocompleteBH,
      display: 'value',
      templates: {
        empty: '<div class="empty-message">Nothing found.</div>',
        suggestion: templates['MaterialTypeahead'],
      }
    });
}

/**
 *
 */
function initTemplates() {
  var templateSelectors = {
    'MaterialItem': '.template-material-item',
    'MaterialIconLayer': '.template-material-icon-layer',
    'MaterialIconWrapper': '.template-material-icon-wrapper',
    'MaterialTableRow': '.template-material-table-row',
    'MaterialTypeahead': '.template-material-typeahead',
  };

  for (let [key, selector] of Object.entries(templateSelectors)) {
    var $template = $(selector);
    templates[key] = Handlebars.compile($template.html());
  }
}


// Handle on document ready.
//(function ($) {
/*uniqueMaterials.forEach(function (material) {
  var option = '<option value="' + material + '">' + material + '</option>';
  $('#materials').append(option);
});

for (let [jobName, jobNameMats] of Object.entries(jobMats)) {
  var option = '<option value="' + jobName + '">Job: ' + jobName + '</option>';
  $('#materials').append(option);
}

for (let [charName, charProps] of Object.entries(charPropMap)) {
  var option = '<option value="' + charName + '">Character: ' + charName + '</option>';
  $('#materials').append(option);
}

for (let [itemName, charProps] of Object.entries(itemRecipeMap)) {
  var option = '<option value="' + itemName + '">Equip: ' + itemName + '</option>';
  $('#materials').append(option);
}

var selectEl = document.querySelector('#materials');
accessibleAutocomplete.enhanceSelectElement({
  autoselect: true,
  confirmOnBlur: false,
  displayMenu: 'overlay',
  defaultValue: "",
  minLength: 3,
  selectElement: selectEl
});*/


/*$(document).ready(function () {
  var $body = $('body');

  $body.on('click', '.nav-main a', function (e) {
    e.preventDefault();
    $('.nav-main a').removeClass('active');
    $(this).addClass('active');
  });

  $body.on('click', '.toggle-dark-mode', function (e) {
    $('.toggle-dark-mode').hide();
    $('.toggle-light-mode').show();
    $('body').addClass('dark-mode');
    localStorage.setItem('darkMode', '1');
  });

  $body.on('click', '.toggle-light-mode', function (e) {
    $('.toggle-dark-mode').show();
    $('.toggle-light-mode').hide();
    $('body').removeClass('dark-mode');
    localStorage.setItem('darkMode', '');
  });

  if (localStorage.getItem('darkMode') === '1') {
    $('.toggle-dark-mode').hide();
    $('.toggle-light-mode').show();
    $('body').addClass('dark-mode');
  }

  $body.on('click', '.btn-add', addMaterialFromInput);
  $body.on('click', '.materials-list .btn-close', deleteMaterial);
  $body.on('click', '.btn-clear-all', clearAll);
  $body.on('click', '.btn-export', populateExport);

  $body.on('click', '.nav-search', function (e) {
    $('.mode').hide();
    $('.mode-autocomplete').show();
    $('.autocomplete__input').focus();
  });

  $body.on('click', '.nav-import', function (e) {
    $('.mode').hide();
    $('.mode-import').show();
    $('#import').focus();
  });

  $body.on('click', '.nav-export', function (e) {
    $('.mode').hide();
    $('.mode-export').show();
    populateExport();
    var exportString = $('#export').focus().select().text();
    navigator.clipboard.writeText(exportString);
  });

  $body.on('click', '.btn-mode-cancel', function (e) {
    e.preventDefault();
    $('.mode').hide();
    $('.mode-autocomplete').show();
    $('.nav-main a').removeClass('active');
    $('.nav-main a:first-child').addClass('active');
    $('.autocomplete__input').focus();
  });

  $body.on('click', '.btn-import', function (e) {
    doImport();
    calculate();
    $('.mode-autocomplete').show();
    $('.mode-import').hide();
  });

  // On enter press, don't submit form but instead add material.
  $body.on('keypress', '#materials', function (e) {
    if (e.keyCode != 13) {
      return;
    }

    e.preventDefault();
    addMaterialFromInput();
    calculate();
  });
});*/

//}(jQuery));

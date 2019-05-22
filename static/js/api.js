var api = {};

api.htmlReplaceTable = {
  '<' : '&lt;',
  '>' : '&gt;',
  '\"' : '&quot;',
  '\'' : '&apos;'
};

api.removeIndicator = function(className, thread) {

  var elements = (thread || document).getElementsByClassName(className);

  if (!elements.length) {
    return;
  }

  elements[0].nextSibling.remove();
  elements[0].remove();

};

api.addIndicator = function(className, title, thread) {

  var spanId = (thread || document).getElementsByClassName('spanId')[0];

  if (!spanId) {
    spanId = (thread || document).getElementsByClassName('labelCreated')[0];
  }

  var indicator = document.createElement('span');
  indicator.className = className;
  indicator.title = title;

  spanId.parentNode.insertBefore(indicator, spanId.nextSibling);
  spanId.parentNode.insertBefore(document.createTextNode(' '),
      spanId.nextSibling);

};

api.resetIndicators = function(data, thread) {

  api.removeIndicator('lockIndicator', thread);
  api.removeIndicator('pinIndicator', thread);
  api.removeIndicator('cyclicIndicator', thread);

  api.addIndicator('cyclicIndicator', 'Cyclical Thread', thread);
  api.addIndicator('pinIndicator', 'Sticky', thread);
  api.addIndicator('lockIndicator', 'Locked', thread);

  if (!data.locked) {
    api.removeIndicator('lockIndicator', thread);
  }

  if (!data.pinned) {
    api.removeIndicator('pinIndicator', thread);
  }

  if (!data.cyclic) {
    api.removeIndicator('cyclicIndicator', thread);
  }

};

api.addEnterEvent = function(element, onclick) {

  element.addEventListener('keydown', function(event) {

    if (event.key === 'Enter') {
      onclick();
      event.preventDefault();
    }

  });

};

api.convertButton = function(button, onclick, inputs) {

  if (typeof (button) === 'string') {
    button = document.getElementById(button);
  }

  button.type = 'button';
  button.onclick = onclick;

  if (!inputs) {
    return;
  }

  inputs = document.getElementsByClassName(inputs);

  for (var i = 0; i < inputs.length; i++) {
    api.addEnterEvent(inputs[i], onclick);
  }

};

api.getCookies = function() {

  var parsedCookies = {};

  var cookies = document.cookie.split(';');

  for (var i = 0; i < cookies.length; i++) {

    var cookie = cookies[i];

    var parts = cookie.split('=');
    parsedCookies[parts.shift().trim()] = decodeURI(parts.join('='));

  }

  return parsedCookies;

};

api.handleConnectionResponse = function(xhr, callback) {

  var response;

  try {
    response = JSON.parse(xhr.responseText);

  } catch (error) {
    alert('Error in parsing response.');
    return;
  }

  if (response.auth && response.auth.authStatus === 'expired') {
    document.cookie = 'hash=' + response.auth.newHash + '; path=/; expires='
        + new Date(response.auth.expiration).toUTCString();
  }

  if (response.status === 'error') {
    alert('Internal server error. ' + response.data);
  } else if (response.status === 'fileTooLarge') {
    alert('Maximum file size exceeded for a file.');
  } else if (response.status === 'hashBan') {

    var desc = '';

    var bans = response.data;

    for (var i = 0; i < bans.length; i++) {
      var ban = bans[i];

      if (i) {
        desc += '\n';
      }

      desc += 'File ' + ban.file + ' is banned from '
          + (ban.boardUri ? '/' + ban.boardUri + '/' : 'all boards.');

    }

    alert(desc);
  } else if (response.status === 'formatNotAllowed') {
    alert('A file had a format that is not allowed by the server.');
  } else if (response.status === 'blank') {
    alert('Parameter ' + response.data + ' was sent in blank.');
  } else if (response.status === 'bypassable') {

    postCommon.displayBlockBypassPrompt(function() {
      alert('You may now post');
    });

  } else if (response.status === 'tooLarge') {
    alert('Request refused because it was too large');
  } else if (response.status === 'construction') {
    alert('This page is under construction. Come back later, your grandma is almost done sucking me.');
  } else if (response.status === 'denied') {
    alert('You are not allowed to perform this operation.');
  } else if (response.status === 'maintenance') {
    alert('The site is going under maintenance and all of it\'s functionalities are disabled temporarily.');
  } else if (response.status === 'fileParseError') {
    alert('An uploaded file could not be parsed.');
  } else if (response.status === 'parseError') {
    alert('Your request could not be parsed.');
  } else if (response.status === 'banned') {
    if (response.data.range) {
      alert('Your ip range ' + response.data.range + ' has been banned from '
          + response.data.board + '.');
    } else {

      var message = 'You are banned from ' + response.data.board + ' until '
          + new Date(response.data.expiration).toString() + '.\nReason: '
          + response.data.reason + '.\nYour ban id: ' + response.data.banId
          + '.';

      if (!response.data.appealled) {
        message += '\nYou may appeal this ban.';

        var appeal = prompt(message, 'Write your appeal');

        if (appeal) {

          api.apiRequest('appealBan', {
            appeal : appeal,
            banId : response.data.banId
          }, function appealed() {

            alert('Ban appealed');

          });

        }

      } else {
        alert(message);
      }

    }
  } else {
    callback(response.status, response.data);
  }

};

// Makes a request to the back-end.
// page: url of the api page
// parameters: parameter block of the request
// callback: callback that will receive (data,status). If the callback
// has a function in stop property, it will be called when the connection stops
// loading.
api.apiRequest = function(page, parameters, callback) {

  var xhr = new XMLHttpRequest();

  if ('withCredentials' in xhr) {
    xhr.open('POST', '/.api/' + page, true);
  } else if (typeof XDomainRequest != 'undefined') {

    xhr = new XDomainRequest();
    xhr.open('POST', '/.api/' + page);
  } else {
    alert('This site can\'t run js on your shitty browser because it does not support CORS requests. Disable js and try again.');

    return;
  }

  xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');

  if (callback.hasOwnProperty('progress')) {
    xhr.upload.onprogress = callback.progress;
  }

  xhr.onreadystatechange = function connectionStateChanged() {

    if (parameters.captcha) {
      captchaUtils.reloadCaptcha();
    }

    if (xhr.readyState == 4) {

      if (callback.hasOwnProperty('stop')) {
        callback.stop();
      }

      if (xhr.status != 200) {
        alert('Connection failed.');
        return;
      }

      api.handleConnectionResponse(xhr, callback);
    }
  };

  var parsedCookies = api.getCookies();

  var body = {
    captchaId : parsedCookies.captchaid,
    bypassId : parsedCookies.bypass,
    parameters : parameters,
    auth : {
      login : parsedCookies.login,
      hash : parsedCookies.hash
    }
  };

  xhr.send(JSON.stringify(body));

};

api.localRequest = function(address, callback) {

  var xhr = new XMLHttpRequest();

  if ('withCredentials' in xhr) {
    xhr.open('GET', address, true);
  } else if (typeof XDomainRequest != 'undefined') {

    xhr = new XDomainRequest();
    xhr.open('GET', address);
  } else {
    alert('This site can\'t run js on your shitty browser because it does not support CORS requests. Disable js and try again.');
    return;
  }

  xhr.onreadystatechange = function connectionStateChanged() {

    if (xhr.readyState == 4) {

      if (callback.hasOwnProperty('stop')) {
        callback.stop();
      }

      if (xhr.status != 200) {
        callback('Connection failed');
      } else {
        callback(null, xhr.responseText);
      }

    }
  };

  xhr.send();

};

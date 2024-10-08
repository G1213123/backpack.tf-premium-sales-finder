// ==UserScript==
// @name        backpack.tf Premium Recent Sales Finder
// @namespace   http://steamcommunity.com/profiles/76561198080179568/
// @version     4.1.1
// @description Adds coloring to history pages indicating recent sales and includes compare links for sales
// @author      Julia
// @updateURL   https://github.com/G1213123/backpack.tf-premium-sales-finder/raw/master/backpacktf-premium-sales-finder.meta.js
// @downloadURL https://github.com/G1213123/backpack.tf-premium-sales-finder/raw/master/backpacktf-premium-sales-finder.user.js
// @run-at      document-end
// @grant       GM_addStyle
// @grant       unsafeWindow
// @include     /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/item\/\d+/
// @include     /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/premium\/search.*/
// @include     /^https?:\/\/(.*\.)?backpack\.tf\/profiles\/\d{17}/
// @include     /^https?:\/\/(.*\.)?backpack\.tf\/profiles\/\d{17}#!\/compare\/\d{10}\/\d{10}/
// @include     /^https?:\/\/(.*\.)?backpack\.tf\/unusual\/*/
// ==/UserScript==

(function() {
    'use strict';
    
    const scripts = [
        {
            includes: [
                /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/item\/\d+/
            ],
            fn: function({$, omitEmpty, dayDifference}) {
                // jquery elements
                const PAGE = {
                    $history: $('.history-sheet table.table'),
                    $item: $('.item'),
                    $panelExtras: $('.panel-extras'),
                    $username: $('.username')
                };
                
                // add contents to the page
                (function addTableLinks() {
                    /**
                     * Get a value from a URL according to pattern.
                     * @param {String} url - URL.
                     * @param {Object} pattern - Pattern to match. The 1st match group should be the value we are trying to get.
                     * @returns {(String|null)} Matched value, or null if the pattern does not match.
                     */
                    function getValueFromURL(url, pattern) {
                        const match = (url || '').match(pattern);
                        
                        return (
                            match &&
                            match[1]
                        );
                    }
                    
                    /**
                     * Add contents for a row.
                     * @param {Object} options - Options.
                     * @param {Object} options.table - Object containing details of table.
                     * @param {Number} options.$item - JQuery element for item.
                     * @param {Number} options.index - Index of row.
                     * @param {Object} options.$row - JQuery object of row.
                     * @param {String} [options.loggedInUserSteamId] - The steamid of the currently logged in user.
                     * @param {String} [options.prevSteamId] - The steamid of the previous row.
                     * @returns {undefined}
                     */
                    function addRowContents({table, $item, index, $row, loggedInUserSteamId, prevSteamId}) {
                        // contains methods for adding links
                        const addLink = (function () {
                            /**
                             * Creates a jQuery link.
                             * @param {String} href - URL.
                             * @param {String} contents - HTML contents of link.
                             * @returns {Object} JQuery object of link.
                             */
                            function getLink({href, contents}) {
                                const $link = $('<a/>').html(contents).attr({
                                    'href': href,
                                    'target': '_blank'
                                });
                                
                                return $link;
                            }
                            
                            return {
                                inline({href, contents, $cell}) {
                                    const $link = getLink({href, contents});
                                    const $span = $('<span/>').css({
                                        'float': 'right',
                                        'margin-left': '0.6em'
                                    }).append($link);
                                    
                                    $cell.append($span);
                                },
                                column({href, contents, excludeLink, $cell}) {
                                    // the first row does not include a link
                                    const html = excludeLink ? '--------' : getLink({href, contents});
                                    
                                    $cell.html(html);
                                }
                            };
                        }());
                        // contains methods for getting urls
                        const getURL = {
                            /**
                             * Get URL of your steam history at date.
                             * @param {Object} $item - JQuery object of item.
                             * @param {Object} date - Date of history point.
                             * @returns {String} Inventory history URL.
                             */
                            inventoryHistory($item, date) {
                                const itemname = $item.attr('data-name');
                                // for adding a filter with history bastard -
                                // https://naknak.net/tf2/historybastard/historybastard.user.js
                                const filter = itemname ? '#filter-' + itemname : '';
                                
                                return [
                                    'http://steamcommunity.com/my/inventoryhistory/',
                                    // unix timestamp
                                    '?after_time=' + Math.round(date.getTime() / 1000),
                                    '&prev=1',
                                    filter 
                                ].join('');
                            },
                            /**
                             * Get URL of compare link on backpack.tf.
                             * @param {String} steamid - SteamID of user.
                             * @param {Object} date - Date of history point.
                             * @returns {String} Inventory comparison URL.
                             */
                            compare(steamid, date) {
                                // set date to beginning of day
                                date.setUTCHours(0); 
                                date.setUTCMinutes(0);
                                date.setUTCSeconds(0);
                                date.setUTCMilliseconds(0);
                                
                                // unix timestamp
                                const x = Math.round(date.getTime() / 1000);
                                
                                return [
                                    'https://backpack.tf/profiles/' +
                                    steamid,
                                    '#!',
                                    '/compare/',
                                    x,
                                    '/',
                                    x,
                                    // add "/nearest" so that we can treat this compare link in a special manner
                                    // 'getInventory' will be called when this link is loaded
                                    '/nearest' 
                                ].join('');
                            }
                        };
                        // get an object of the columns for this row by each column name e.g. "User"
                        const rowColumns = Object.entries(table).reduce((prev, [name, column]) => {
                            // get nth cell in column cells
                            prev[name] = column.$cells.eq(index);
                            
                            return prev;
                        }, {});
                        // get href from last seen
                        const href = rowColumns['Last seen'].find('a').attr('href');
                        // to extract its timmestamp value
                        const timestampValue = getValueFromURL(href, /time=(\d+)$/);
                        // then convert that value into a date
                        // it is the date when the item was last seen
                        const lastSeenDate = new Date(parseInt(timestampValue) * 1000);
                        // get the steamid of the user from the row
                        const userSteamId = rowColumns['User'].find('.user-handle a').attr('data-id');
                        // add links for row
                        const itemname = $item.attr('data-name');
                        // adds highlighting to row
                        const days = dayDifference(lastSeenDate, new Date());
                        
                        // add coloring depending on how long ago the hat was last sold
                        if (days <= 60) {
                            $row.addClass('success');
                        } else if (days <= 90) {
                            $row.addClass('warning');
                        } else if (days <= 120) {
                            $row.addClass('danger');
                        }
                        
                        // links to be added to the row
                        const links = {
                            column: [
                                // compare link for seller->buyer
                                {
                                    href: getURL.compare(userSteamId, lastSeenDate),
                                    contents: 'Compare',
                                    // do not include the link if the index is 0
                                    excludeLink: index === 0,
                                    // add the link to the buyer cell
                                    $cell: rowColumns.Seller
                                },
                                // compare link for buyer->seller
                                {
                                    href: getURL.compare(prevSteamId, lastSeenDate),
                                    contents: 'Compare',
                                    // do not include the link if the index is 0
                                    excludeLink: index === 0,
                                    // add the link to the seller cell
                                    $cell: rowColumns.Buyer
                                }
                            ],
                            inline: []
                        };
                        
                        const addSteamLink = Boolean(
                            loggedInUserSteamId &&
                            // do not show if current owner, unless there is no item name (moved elsewhere)
                            // logged in user and steamid of row must match
                            ((prevSteamId || !itemname) && (loggedInUserSteamId == userSteamId)) ||
                            // if previous row steamid is the same as logged in user
                            (loggedInUserSteamId == prevSteamId)
                        );
                        
                        // add steam link if all conditions are met
                        if (addSteamLink) {
                            links.inline.push({
                                href: getURL.inventoryHistory($item, lastSeenDate),
                                contents: '<i class="stm stm-steam"/>',
                                // add the link to the user cell
                                $cell: rowColumns.User
                            });
                        }
                        
                        // add the links
                        Object.entries(links).forEach(([name, links]) => {
                            links.forEach(addLink[name]);
                        });
                        
                        // set prev steamid to current now that we are done with this row
                        return userSteamId;
                    }
                    
                    const {$history, $item, $username} = PAGE;
                    const $rows = $history.find('tbody > tr');
                    const columnDefinitions = [
                        {
                            columnName: 'Seller',
                            after: 'User'
                        },
                        {
                            columnName: 'Buyer',
                            after: 'User'
                        }
                    ];
                    // creates a new column (and adds the header after the previous column)
                    const defineColumn = ($rows, columnName, prevColumn) => {
                        // get the index and header from the previous column
                        const {index, $header, $cells} = prevColumn;
                        const $prevTds = $cells;
                        // increment from previous
                        const columnIndex = index + 1;
                        const $th = $('<th/>').text(columnName);
                        // a blank td
                        const $td = $('<td/>').html(columnName);
                        
                        // add the header
                        $th.insertAfter($header);
                        // add the td after each previous td
                        $td.insertAfter($prevTds);
                        
                        const $columnCells = $rows.find(`> td:nth-child(${columnIndex + 1})`);
                        
                        return {
                            index: columnIndex,
                            $header: $th,
                            $cells: $columnCells
                        };
                    };
                    let columnsAdded = 0;
                    // construct a table
                    const table = $history
                        // all table headers in table head
                        .find('thead tr th')
                        // get the data for each column
                        .map((index, el) => {
                            const $header = $(el);
                            const name = $header.text().trim();
                            const $cells = $rows.find(`> td:nth-child(${index + 1})`);
                            
                            return {
                                name,
                                // add index so we know the order of each column
                                index,
                                $header,
                                $cells
                            };
                        })
                        // get raw array value from jQuery map
                        .get()
                        // then reduce into object where the key is the column's name
                        .reduce((prev, column) => {
                            const {name, index, $header, $cells} = column;
                            
                            // assign column based on column heading text
                            prev[name] = {
                                index: index + columnsAdded,
                                $header,
                                $cells
                            };
                            
                            const columnsToAdd = columnDefinitions.filter(({after}) => {
                                return after === name;
                            });
                            let prevColumn = prev[name];
                            
                            columnsAdded += columnsToAdd.length;
                            columnsToAdd.forEach(({columnName}) =>{
                                prev[columnName] = defineColumn($rows, columnName, prevColumn);
                                prevColumn = prev[columnName];
                            });
                            
                            return prev;
                        }, {});
                    // throw 'no';
                    // get the href from the element containing details of the logged in user
                    const loggedInUserHref = $username.find('a').attr('href');
                    // current logged in user
                    const loggedInUserSteamId = getValueFromURL(loggedInUserHref, /\/profiles\/(\d{17})$/);
                    let prevSteamId;
                    
                    // iterate to add links for each row
                    $rows.each((index, el) => {
                        const $row = $(el);
                        
                        // function will return the steamid of the row
                        // which can then be passed to the next iteration
                        prevSteamId = addRowContents({
                            table,
                            $item,
                            index,
                            $row,
                            loggedInUserSteamId,
                            prevSteamId
                        });
                    });
                }());
                // add buttons to the page
                (function addButtons() {
                    /**
                     * Adds a button link to the page.
                     * @param {Object} options - Options.
                     * @param {String} options.name - Link text.
                     * @param {String} options.url - URL of link.
                     * @param {String} [options.icon='fa-search'] - The icon for the link.
                     * @param {Object} $container - JQuery object for container.
                     * @returns {undefined}
                     */
                    function addButton($container, {name, url, icon}) {
                        let $pullRight = $container.find('.pull-right');
                        const $btnGroup = $('<div class="btn-group"/>');
                        const $link = $(`<a class="btn btn-panel" href="${url}"><i class="fa ${icon || 'fa-search'}"></i> ${name}</a>`);
                        
                        if ($pullRight.length === 0) {
                            // add a pull-right element if one does not already exist
                            // so that we can left align this on the right of the panel
                            $pullRight = $('<div class="pull-right"/>');
                            $container.append($pullRight);
                        }
                        
                        $btnGroup.append($link);
                        $pullRight.prepend($btnGroup);
                    }
                    
                    const urlGenerators = {
                        // get details for bot.tf listing snapshots link to page
                        botTF($item) {
                            const data = $item.data();
                            const params = omitEmpty({
                                def: data.defindex,
                                q: data.quality,
                                ef: data.effect_name,
                                craft: data.craftable ? 1 : 0,
                                aus: data.australium ? 1 : 0,
                                ks: data.ks_tier || 0
                            });
                            const queryString = Object.keys(params).map((key) => {
                                return `${key}=${encodeURIComponent(params[key])}`;
                            }).join('&');
                            const url = 'https://bot.tf/stats/listings?' + queryString;
                            
                            return url;
                        },
                        // add marketplace link to page
                        marketplaceTF($item) {
                            const data = $item.data();
                            const $itemIcon = $item.find('.item-icon');
                            // get the war paint id from the background image
                            const backgroundImage = $itemIcon.css('background-image');
                            // matches the url for a war paint image
                            const reWarPaintPattern = /https:\/\/scrap\.tf\/img\/items\/warpaint\/(?:(?![×Þß÷þø_])[%\-'0-9a-zÀ-ÿA-z])+_(\d+)_(\d+)_(\d+)\.png/i;
                            const warPaintMatch = backgroundImage.match(reWarPaintPattern);
                            // will be in first group
                            const warPaintId = warPaintMatch ? warPaintMatch[1] : null;
                            // get the id of the wear using the name of the wear
                            const wearId = {
                                'Factory New': 1,
                                'Minimal Wear': 2,
                                'Field-Tested': 3,
                                'Well-Worn': 4,
                                'Battle Scarred': 5
                            }[data.wear_tier];
                            const params = [
                                data.defindex,
                                data.quality,
                                data.effect_id ? 'u' + data.effect_id : null,
                                wearId ? 'w' + wearId : null,
                                warPaintId ? 'pk' + warPaintId : null,
                                data.ks_tier ? 'kt-' + data.ks_tier : null,
                                data.australium ? 'australium' : null,
                                !data.craftable ? 'uncraftable' : null,
                                // is a strange version
                                data.quality_elevated == '11' ? 'strange' : null
                            ].filter(param => param !== null);
                            const url = 'https://marketplace.tf/items/tf2/' + params.join(';');
                            
                            return url;
                        }
                    };
                    
                    // only if an item exists on page
                    if (PAGE.$item.length > 0) {
                        const $item = PAGE.$item;
                        const $container = PAGE.$panelExtras;
                        const generators = {
                            'Bot.tf': urlGenerators.botTF,
                            'Marketplace.tf': urlGenerators.marketplaceTF
                        };
                        
                        Object.entries(generators).forEach(([name, generator]) => {
                            // generate the button details using the generator
                            const url = generator($item);
                            
                            // add it to the given container
                            addButton($container, {
                                name,
                                url
                            });
                        });
                    }
                }());
            }
        },
        {
            includes: [
                /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/premium\/search.*/
            ],
            styles: `
                .premium-search-results .result.success {
                    background-color: #dff0d8;
                }
                
                .premium-search-results .result.warning {
                    background-color: #faf2cc;
                }
                
                .premium-search-results .result.danger {
                    background-color: #f2dede;
                }
            `,
            fn: function({$, dayDifference}) {
                const PAGE = {
                    $results: $('.premium-search-results .result')
                };
                
                (function highlightResults() {
                    function highlightOwner($result, days) {
                        function prependClass($element, front) {
                            const classes = $element.attr('class');
                            
                            $element.attr('class', [front, classes].join(' '));
                        }
                        
                        const $buttons = $result.find('.buttons a');
                        
                        // add coloring depending on how long ago the hat was last sold
                        if (days <= 60) {
                            // we add it to the beginning of the classlist
                            // because the order of classes takes priority in styling (from first to last)
                            prependClass($buttons, 'btn-success');
                            $result.addClass('success');
                        } else if (days <= 90) {
                            prependClass($buttons, 'btn-warning');
                            $result.addClass('warning');
                        } else if (days <= 120) {
                            prependClass($buttons, 'btn-danger');
                            $result.addClass('danger');
                        }
                    }
                    
                    const {$results} = PAGE;
                    
                    $results.each((i, el) => {
                        const $result = $(el);
                        const $previousOwner = $result.find('.owners .owner').eq(1);
                        const $time = $previousOwner.find('abbr');
                        
                        if ($time.length > 0) {
                            const date = new Date($time.attr('title'));
                            const now = new Date();
                            const days = dayDifference(now, date);
                            
                            highlightOwner($result, days);
                        }
                    });
                }());
            }
        },
        {
            includes: [
                /^https?:\/\/(.*\.)?backpack\.tf\/profiles\/\d{17}/
            ],
            fn: function({$}) {
                // jquery elements
                const PAGE = {
                    $snapshots: $('#historicalview option')
                };
                
                // update the location so that each timestamp is at the closest time according to recorded inventory snapshots
                (function changeLocation() {
                    const reHashBangNearest = /^https?:\/\/(.*\.)?backpack\.tf\/profiles\/\d{17}#!\/compare\/\d{10}\/\d{10}\/nearest/;
                    const isFromHashBang = Boolean(
                        reHashBangNearest.test(location.href)
                    );
                    
                    if (!isFromHashBang) {
                        // do nothing
                        return;
                    }
                    
                    /**
                     * Get closet snapshot time according to timestamp.
                     * @param {Number[]} snapshots - Array of snapshot unix timestamps.
                     * @param {Number} timestamp - Unix timestamp.
                     * @param {Boolean} [before] - Whether the closest snapshot should appear before 'timestamp'.
                     * @param {Number} [other] - Snapshot must not be the same as this value.
                     * @returns {(Number|null)} Closest snapshot to date.
                     */
                    function getClosestSnapshot(snapshots, timestamp, before, other) {
                        // sort ascending
                        const asc = (a, b) => (b - a);
                        // sort descending
                        const desc = (a, b) => (a - b);
                        
                        // loop until we find the first result that is at or before the timestamp if "before" is set to true
                        // when "before" is set, array is sorted in descending order, or ascending if not set
                        return snapshots.sort(before ? desc : asc).find((snapshot) => {
                            let isBefore = timestamp <= snapshot;
                            let isAfter = timestamp >= snapshot;
                            let isOther = snapshot === other;
                            
                            return (
                                before ? isBefore : isAfter
                            ) && !isOther; // snapshot must also not be the same as "other"
                        }) || (before ? Math.min : Math.max)(...snapshots);
                        // default value is first or last snapshot if one did not meet conditions
                        // will probably only default to this if the time is closest to the first or last snapshot
                        // or with one-snapshot inventories 
                    }
                    
                    const {$snapshots} = PAGE;
                    // generate page snapshots
                    const snapshots = $snapshots.map((i, el) => {
                        return parseInt(el.value);
                    }).get().filter(Boolean);
                    const reNearest = /(\d{10})\/(\d{10})\/nearest$/;
                    // should always match
                    const timestamps = location.href.match(reNearest).slice(1).map(a => parseInt(a)); 
                    // must be at or before the first date
                    const from = getClosestSnapshot(snapshots, timestamps[0], true); 
                    // must be at or before the second date, and not the same date as 'from'
                    const to = getClosestSnapshot(snapshots, timestamps[1], false, from); 
                    
                    // finally update location.href using new timestamps
                    location.href = location.href.replace(reNearest, [from, to].join('/'));
                }()

                );

                (function incrementButton() {
                    //add date change button
                    function increment_option(increment){
                        const fromSelect = document.getElementById('inventory-cmp-from');
                        const toSelect = document.getElementById('inventory-cmp-to');
                        const oldTime = `${fromSelect.value}/${toSelect.value}`

                        let fromNewIndex = fromSelect.selectedIndex + increment;
                        let toNewIndex = toSelect.selectedIndex + increment;

                        // Update 'From' index if within bounds
                        if (fromNewIndex >= 0 && fromNewIndex < fromSelect.options.length) {
                            fromSelect.selectedIndex = fromNewIndex;
                        }

                        // Update 'To' index if within bounds
                        if (toNewIndex >= 0 && toNewIndex < toSelect.options.length) {
                            toSelect.selectedIndex = toNewIndex;
                        }

                        // Get the current values after possible changes
                        const fromValue = fromSelect.options[fromSelect.selectedIndex].value;
                        const toValue = toSelect.options[toSelect.selectedIndex].value;

                        // Construct the new URL using the selected values
                        location.href = location.href.replace(oldTime, [fromValue, toValue].join('/'));
                        location.reload();

                    }
                    function addButton(text, increment) {
                        const button = document.createElement('button');
                        button.textContent = text;
                        button.type = 'button'; // Prevent the form from submitting
                        button.classList.add('btn-block');
                        button.addEventListener('click', () => increment_option(increment));

                        // Append the button to the form
                        const buttonDiv = document.querySelector('#dateButtonDiv');
                        buttonDiv.appendChild(button);
                    }
                    // Function to check for the form and add buttons
                    function checkAndAddButtons() {
                        const form = document.querySelector('#inventory-cmp-form');
                        if (form) {
                            const buttondiv = document.createElement('div');
                            buttondiv.classList.add('inputs');
                            buttondiv.id = 'dateButtonDiv';
                            form.appendChild(buttondiv);

                            addButton('Previous Date', 1);
                            addButton('Next Date', -1);
                            return true; // Indicate that buttons have been added
                        }
                        return false; // Indicate that the form is not yet available
                    }

                    // Set up a MutationObserver to watch for changes in the body
                    const observer = new MutationObserver(() => {
                        if (checkAndAddButtons()) {
                            observer.disconnect(); // Stop observing once buttons have been added
                        }
                    });

                    observer.observe(document.body, { childList: true, subtree: true });

                    // Initial check in case the form is already present
                    checkAndAddButtons();
                }())
            }
        },
        {includes: [
                /^https?:\/\/(.*\.)?backpack\.tf\/unusual\/*/
            ],
            fn: function({$}) {
            (function addLinktoUnusual(){
                // Function to extract the number from the img src
                function extractNumberFromSrc(src) {
                    const match = src.match(/particles\/(\d+)_/);
                    return match ? match[1] : 1; // Return the extracted number or null if not found
                };

                // Function to create a URL based on the extracted number
                function createLink(name, effect) {
                    return `/premium/search?item=${name}&quality=5&tradable=1&craftable=1&australium=-1&particle=${effect}&killstreak_tier=0`; // Adjust the URL as needed
                };
                const getItemNameFromURL = (text) => {
                    const regex = /\/([^\/?]+)(\?|$)/; // Matches the last segment after the last "/" before "?"
                    const match = text.match(regex);
                    return match ? match[1] : null; // Return the captured group or null if not found
                };
                function overrideTableLink(tableClass){
                    // Select the table by its class
                    const table = document.querySelector(tableClass);

                    // Check if the table exists
                    if (table) {
                        // Get the tbody of the table
                        const tbody = table.querySelector('tbody');

                        // Iterate over each row in the tbody
                        const rows = tbody.querySelectorAll('tr');
                        rows.forEach(row => {
                            const effectName = row.getAttribute('data-effect_name');

                            // Find all th elements in the current row
                            const thElements = row.querySelectorAll('th');
                            thElements.forEach(th => {
                                // Find the img inside the th
                                const img = th.querySelector('img');
                                if (img && img.src) {
                                    // Extract the number from the img src
                                    const effect = extractNumberFromSrc(img.src);
                                    const name = getItemNameFromURL(location.href);
                                    if (effect) {
                                        // Create a link based on the extracted number
                                        const link = createLink(name, effect);

                                        // Create an anchor element
                                        const anchor = document.createElement('a');
                                        anchor.href = link;
                                        anchor.textContent = " " + effectName; // Set the text for the link
                                        anchor.target = '_blank'; // Open in a new tab (optional)

                                        // Clear existing text content but keep the img
                                        th.childNodes.forEach(node => {
                                            if (node.nodeType === Node.TEXT_NODE) {
                                                th.removeChild(node); // Remove only text nodes
                                            }
                                        });
                                        th.appendChild(anchor); // Add the link to the th
                                    }
                                }
                            });
                        });
                    }
                }
                overrideTableLink('.table.table-bordered.unusual-pricelist');
                overrideTableLink('.table.table-bordered.unusual-pricelist-missing');
            }());
            }
        },
    ];
    
    (function() {
        const DEPS = (function() {
            // current version number of script
            const VERSION = '4.1.1';
            // our window object
            const WINDOW = unsafeWindow;
            
            // get our global variables from the window object
            const {$} = WINDOW;
            
            /**
             * Super basic omitEmpty function.
             * @param {Object} obj - Object to omit values from.
             * @returns {Object} Object with null, undefined, or empty string values omitted.
             */
            function omitEmpty(obj) {
                // create clone so we do not modify original object
                let result = Object.assign({}, obj);
                
                for (let k in result) { 
                    if (result[k] === null || result[k] === undefined || result[k] === '') {
                        delete result[k];
                    }
                }
                
                return result;
            }
            
            /**
             * Get difference in days between two dates.
             * @param {Object} date1 - First date.
             * @param {Object} date2 - Second date.
             * @returns {Number} Difference.
             */
            function dayDifference(date1, date2) {
                const oneDay = 24 * 60 * 60 * 1000;
                const difference = Math.abs(date1.getTime() - date2.getTime());
                
                return Math.round(difference / oneDay);
            }
            
            return {
                VERSION,
                WINDOW,
                $,
                omitEmpty,
                dayDifference
            };
        }());
        const script = scripts.find(({includes}) => {
            return includes.some((pattern) => {
                return Boolean(location.href.match(pattern));
            });
        });
        
        if (script) {
            if (script.styles) {
                // add the styles
                GM_addStyle(script.styles);
            }
            
            if (script.fn) {
                // run the script
                script.fn(DEPS);
            }
        }
    }());
}());

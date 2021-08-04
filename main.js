const main = require('ldapjs');
ldapSearch('dc01.rvision.local', 'а', 's-sense_AD_service', '1Ht7RwKSEel7QJt6', false, 0, false)
    .then((result => console.log(result)));

/**
 * Выполняет поиск пользователей в домене с адресом url.
 *
 * @param url адрес хоста с AD
 * @param search Строка поиска. Поиск выполняется по частичному совпадению (по началу)
 * @param user Имя пользователя для подключения к ldap
 * @param password Пароль пользователя для подключения к ldap
 * @param strict Строгое соответствие search (strict === true) или частичное совпадение (начало строки)
 * @param mode
 *      mode = 0 - поиск пользователей по полям displayname и sAMAccountName;
 *      mode = 1 - поиск пользователей по полю AMAccountName;
 *      mode = 2 - поиск пользователей по полю displayname;
 *      mode = 3 - поиск групп по полю name;
 * @param loadPhoto Нужно ли загружать фото
 * @returns {Promise<any>} Promise возвращает массив объектов {logonName: ..., displayName: ..., mail: ..., photo: ...}
 */
function ldapSearch(url, search, user, password, strict, mode, loadPhoto) {

    return new Promise(function (resolve, reject) {

        let filter = '';
        const searchFilter = search + (strict ? '' : '*');

        switch (mode) {
            case 0:
                filter = `(&(objectClass=user)(|(cn=${searchFilter})(sAMAccountName=${searchFilter})(displayname=${searchFilter}))(!(userAccountControl:1.2.840.113556.1.4.803:=2)))`;
                break;
            case 1:
                filter = `(&(objectClass=user)(|(cn=${searchFilter})(sAMAccountName=${searchFilter}))(!(userAccountControl:1.2.840.113556.1.4.803:=2)))`;
                break;
            case 2:
                filter = `(&(objectClass=user)(|(cn=${searchFilter})(displayname=${searchFilter}))(!(userAccountControl:1.2.840.113556.1.4.803:=2)))`;
                break;
            case 3:
                filter = `(&(objectCategory=group)(name=${searchFilter}))`;
                break;
            default:
                break;
        }

        const options = {
            filter: filter,
            scope: 'sub',
            attributes: ['cn', 'sAMAccountName', 'displayname', 'mail', 'thumbnailphoto', 'telephoneNumber', 'mobile', 'title', 'jobTitle'],
        };

        const client = main.createClient({
            url,
            reconnect: true,
            timeout: 30000,
            connectTimeout: 30000,
        });

        client.bind(user, password, function (err) {
            if (err) {
                reject(err);
            } else {
                const result = [];
                client.search(Domains[domain.toLowerCase()].dn, options, function (err, search) {
                    if (err) {
                        client.unbind();
                        client.destroy();
                        return reject(err);
                    }

                    search.on('searchEntry', function (entry) {

                        if (mode === 0 || mode === 1 || mode === 2) {
                            const user = {
                                isUser: true,
                                logonName: null,
                                displayName: null,
                                email: null,
                                photo: null,
                                workPhoneNumber: null,
                                mobilePhoneNumber: null,
                                position: null,
                            };
                            entry.attributes.forEach(a => {
                                switch (a.type) {
                                    case 'sAMAccountName':
                                        user.logonName =
                                            a.vals.length > 0
                                                ? domain.toLowerCase() + '\\' + a.vals[0].toLowerCase()
                                                : '';
                                        break;
                                    case 'displayName':
                                        user.displayName = a.vals.length > 0 ? a.vals[0] : '';
                                        break;
                                    case 'mail':
                                        user.email = a.vals.length > 0 ? a.vals[0] : '';
                                        break;
                                    case 'thumbnailPhoto':
                                        if (loadPhoto)
                                            user.photo =
                                                a.buffers.length > 0 ? a.buffers[0].toString('base64') : '';
                                        break;
                                    case 'telephoneNumber':
                                        user.workPhoneNumber = a.vals.length > 0 ? a.vals[0] : '';
                                        break;
                                    case 'mobile':
                                        user.mobilePhoneNumber = a.vals.length > 0 ? a.vals[0] : '';
                                        break;
                                    case 'title':
                                        user.position = a.vals.length > 0 ? a.vals[0] : '';
                                        break;
                                    default:
                                        break;
                                }
                            });
                            result.push(user);
                        }
                        else if (mode === 3) {
                            const group = {
                                isGroup: true,
                                name: null,
                            };
                            entry.attributes.forEach(a => {
                                switch (a.type) {
                                    case 'cn':
                                        group.name =
                                            a.vals.length > 0
                                                ? domain.toLowerCase() + '\\' + a.vals[0].toLowerCase()
                                                : '';
                                        break;
                                    default:
                                        break;
                                }
                            });
                            result.push(group);
                        }
                    });

                    search.on('end', () => {
                        client.unbind();
                        client.destroy();
                        resolve(result);
                    });

                    search.on('error', err => {
                        client.unbind();
                        client.destroy();
                        reject(err);
                    });
                });
            }
        });
    });
}
